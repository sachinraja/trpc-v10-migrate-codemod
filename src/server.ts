import { CallExpression, CodeBlockWriter, Node, SourceFile, SyntaxKind, VariableDeclarationKind } from 'ts-morph'
import { getRandomHash, getStringLiteralOrText, writeValueFromObjectLiteralElement } from './utils.js'

type ProcedureUnit = {
	tag: 'procedure'
	type: string
	pathText: string
	options?: Node
	middlewares: MiddlewareUnit[]
	middlewaresHash?: string
}

type RouterUnit = {
	tag: 'router'
	prefix: string
	identifier: string
}

type MiddlewareUnit = {
	tag: 'middleware'
	id: string
	body: string
}

type Unit = ProcedureUnit | RouterUnit | MiddlewareUnit

const handleRouterPropertyAccessor = (
	options: { node: Node; arguments: Node[]; middlewares: MiddlewareUnit[] },
): Unit => {
	const { node, arguments: arguments_, middlewares } = options

	const propertyAccessorText = node.getText()
	if (propertyAccessorText === 'merge') {
		const [prefix, router] = arguments_
		return {
			tag: 'router',
			prefix: getStringLiteralOrText(prefix),
			identifier: router.getText(),
		}
	}

	if (propertyAccessorText === 'middleware') {
		const [function_] = arguments_
		return {
			tag: 'middleware',
			id: `middleware_${getRandomHash()}`,
			body: function_.getText(),
		}
	}

	const [path, optionsNode] = arguments_
	return {
		tag: 'procedure',
		type: node.getText(),
		pathText: getStringLiteralOrText(path),
		options: optionsNode,
		middlewares,
		middlewaresHash: middlewares.length > 0 ? middlewares.map((v) => v.id).join(',') : undefined,
	}
}

type GetRouterProceduresOptions = {
	node: CallExpression
	units?: Unit[]
	middlewares?: MiddlewareUnit[]
}

export const getRouterProcedures = (
	options: GetRouterProceduresOptions,
): { units: Unit[]; topNode: Node } => {
	const { node, units = [], middlewares = [] } = options

	const propertyAccessParent = node.getParentIfKind(SyntaxKind.PropertyAccessExpression)

	if (!propertyAccessParent) return { units, topNode: node }
	const propertyAccessor = propertyAccessParent.getChildAtIndex(2)

	const callExpressionParent = propertyAccessParent.getParentIfKind(SyntaxKind.CallExpression)
	if (!callExpressionParent) return { units, topNode: propertyAccessParent }

	const unit = handleRouterPropertyAccessor({
		node: propertyAccessor,
		arguments: callExpressionParent.getArguments(),
		middlewares,
	})
	units.push(unit)

	const newMiddlewares = unit.tag === 'middleware' ? [...middlewares, unit] : middlewares

	return getRouterProcedures({ node: callExpressionParent, units, middlewares: newMiddlewares })
}

export const writeNewRouter = (
	options: { units: Unit[]; sourceFile: SourceFile; topNode: Node },
) => {
	const { units, sourceFile, topNode } = options

	const procedureUnits = units.filter((unit): unit is ProcedureUnit => unit.tag === 'procedure')
	const routerUnits = units.filter((unit): unit is RouterUnit => unit.tag === 'router')

	const procedureMiddlewareHashes = procedureUnits
		.map((unit) => unit.middlewares)
		.filter((unit) => unit.length > 0)
	const uniqueMiddlewareCombinations = new Set(procedureMiddlewareHashes)

	const middlewareHashProcedureMap = new Map<MiddlewareUnit[], string>()
	for (const middlewares of uniqueMiddlewareCombinations.values()) {
		middlewareHashProcedureMap.set(middlewares, `procedure_${getRandomHash()}`)
	}

	type ProcedureOrRouterRecord = Record<string, ProcedureUnit | RouterShape>
	type RouterShape =
		& Pick<RouterUnit, 'tag' | 'prefix'>
		& { units: ProcedureOrRouterRecord; text?: string }

	const routerShape: RouterShape = {
		tag: 'router',
		units: {},
		prefix: '',
	}
	const addProcedure = (shape: RouterShape, procedureUnit: ProcedureUnit, pathParts: string[], index = 0) => {
		if (pathParts.length - 1 === index) {
			shape.units[pathParts[index]] = procedureUnit
			return
		}
		const router: RouterShape = {
			tag: 'router',
			prefix: pathParts[index],
			units: {},
		}
		shape.units[pathParts[index]] = router
		addProcedure(router, procedureUnit, pathParts, index + 1)
	}

	const addRouter = (shape: RouterShape, routerUnit: RouterUnit, pathParts: string[], index = 0) => {
		if (pathParts.length - 1 === index) {
			shape.units[pathParts[index]] = {
				tag: 'router',
				prefix: pathParts[index],
				text: routerUnit.identifier,
				units: {},
			}
			return
		}
		const router: RouterShape = {
			tag: 'router',
			prefix: pathParts[index],
			units: {},
		}
		shape.units[pathParts[index]] = router

		addRouter(router, routerUnit, pathParts, index + 1)
	}

	for (const unit of procedureUnits) {
		const pathParts = unit.pathText.split('.')
		addProcedure(routerShape, unit, pathParts)
	}

	for (const unit of routerUnits) {
		const pathParts = unit.prefix.split('.').filter((value) => value !== '')
		addRouter(routerShape, unit, pathParts)
	}

	const writeProcedure = (writer: CodeBlockWriter, unit: ProcedureUnit) => {
		const { type, options, middlewares } = unit

		const procedureHash = middlewareHashProcedureMap.get(middlewares) ?? 't.procedure'

		writer.write(procedureHash)
		if (Node.isObjectLiteralExpression(options)) {
			for (const procedureOption of ['input', 'output', 'meta']) {
				const property = options?.getProperty(procedureOption)
				if (!property) continue

				writer.write(`.${procedureOption}(`)
				writeValueFromObjectLiteralElement(writer, property)
				writer.write(`)`)
			}

			const resolver = options?.getProperty('resolve')
			if (resolver) {
				writer.write(`.${type}(`)
				writeValueFromObjectLiteralElement(writer, resolver)
				writer.write(')')
			}
		} else {
			writer.write(`.${type}(${options?.getText() ?? ''})`)
		}
		writer.write(',')
		return
	}

	const writeShape = (writer: CodeBlockWriter, procedureOrShape: RouterShape | ProcedureUnit, path?: string) => {
		if (procedureOrShape.tag === 'router') {
			if ('text' in procedureOrShape) {
				const { text } = procedureOrShape
				writer.writeLine(`${path}: ${text},`)
				return
			}

			if (path) {
				writer.write(`${path}: `)
			}

			writer.write(`t.router(`).inlineBlock(() => {
				for (const [path, nestedShape] of Object.entries(procedureOrShape.units)) {
					writeShape(writer, nestedShape, path)
				}
			}).write(')')

			if (path) {
				writer.write(',')
			}

			return
		}

		writer.write(`${path}: `)
		writeProcedure(writer, procedureOrShape)
		return
	}

	topNode.replaceWithText((writer) => {
		writeShape(writer, routerShape)
	}).formatText()

	const middlewareUnits = units.filter((unit): unit is MiddlewareUnit => unit.tag === 'middleware')

	const ancestors = topNode.getAncestors()
	const topLevelNode = ancestors[ancestors.length - 2]

	for (const unit of middlewareUnits) {
		sourceFile.insertVariableStatement(topLevelNode.getChildIndex(), {
			declarationKind: VariableDeclarationKind.Const,
			declarations: [{
				name: unit.id,
				initializer: `t.middleware(${unit.body})`,
			}],
		}).formatText()
	}

	for (const [middlewares, procedureHash] of middlewareHashProcedureMap.entries()) {
		const middlewareUses: string[] = []
		for (const middleware of middlewares) {
			middlewareUses.push(`.use(${middleware.id})`)
		}
		sourceFile.insertVariableStatement(topLevelNode.getChildIndex(), {
			declarationKind: VariableDeclarationKind.Const,
			declarations: [{
				name: procedureHash,
				initializer: `t.procedure${middlewareUses.join('')}`,
			}],
		})
	}
}
