import {
	CallExpression,
	CodeBlockWriter,
	Node,
	Project,
	SourceFile,
	SyntaxKind,
	VariableDeclarationKind,
} from 'ts-morph'
import { MigrateConfig } from './types.js'
import { getStringHash, getStringLiteralOrText, writeValueFromObjectLiteralElement } from './utils.js'

interface ProcedureUnit {
	tag: 'procedure'
	type: string
	pathText: string
	options?: Node
	middlewares: MiddlewareUnit[]
	middlewaresHash?: string
}

interface RouterUnit {
	tag: 'router'
	prefix?: string
	identifier: string
}

interface MiddlewareUnit {
	tag: 'middleware'
	id: string
	hash: number
	body: string
}

type Unit = ProcedureUnit | RouterUnit | MiddlewareUnit

const handleRouterPropertyAccessor = (
	options: { node: Node; arguments: Node[]; middlewares: MiddlewareUnit[] },
): Unit => {
	const { node, arguments: arguments_, middlewares } = options

	const propertyAccessorText = node.getText()
	if (propertyAccessorText === 'merge') {
		if (arguments_.length === 1) {
			return {
				tag: 'router',
				identifier: arguments_[0].getText(),
			}
		}

		const [prefix, router] = arguments_
		return {
			tag: 'router',
			prefix: getStringLiteralOrText(prefix),
			identifier: router.getText(),
		}
	}

	if (propertyAccessorText === 'middleware') {
		const [function_] = arguments_
		const middlewareBody = function_.getText()
		const hash = getStringHash(middlewareBody)
		return {
			tag: 'middleware',
			id: `middleware_${hash}`,
			hash,
			body: middlewareBody,
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

interface GetRouterProceduresOptions {
	node: CallExpression
	units?: Unit[]
	middlewares?: MiddlewareUnit[]
}

export const getRouterUnits = (
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

	return getRouterUnits({ node: callExpressionParent, units, middlewares: newMiddlewares })
}

type ProcedureOrRouterRecord = Record<string, ProcedureUnit | RouterShape>
interface RouterShape extends Pick<RouterUnit, 'tag' | 'prefix'> {
	units: ProcedureOrRouterRecord
	text?: string
}

type MiddlewareProcedureIdMap = Map<MiddlewareUnit[], string>

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

const writeProcedure = (options: { writer: CodeBlockWriter; unit: ProcedureUnit; baseProcedureId: string }) => {
	const { writer, unit, baseProcedureId } = options
	const { type, options: optionsNode } = unit

	writer.write(baseProcedureId)
	if (Node.isObjectLiteralExpression(optionsNode)) {
		for (const procedureOption of ['input', 'output', 'meta']) {
			const property = optionsNode?.getProperty(procedureOption)
			if (!property) continue

			writer.write(`.${procedureOption}(`)
			writeValueFromObjectLiteralElement(writer, property)
			writer.write(`)`)
		}

		const resolver = optionsNode?.getProperty('resolve')
		if (resolver) {
			writer.write(`.${type}(`)
			writeValueFromObjectLiteralElement(writer, resolver)
			writer.write(')')
		}
	} else {
		writer.write(`.${type}(${optionsNode?.getText() ?? ''})`)
	}
	return
}

const writeShape = (
	options: {
		writer: CodeBlockWriter
		procedureOrShape: RouterShape | ProcedureUnit
		path?: string
		middlewaresProcedureIdMap: MiddlewareProcedureIdMap
		config: MigrateConfig
	},
) => {
	const { writer, procedureOrShape, path, middlewaresProcedureIdMap, config } = options
	if (path) {
		writer.write(path).write(': ')
	}

	if (procedureOrShape.tag === 'router') {
		if ('text' in procedureOrShape) {
			const { text } = procedureOrShape
			writer.write(`${text},`)
			return
		}

		writer.write(`t.router(`).inlineBlock(() => {
			for (const [path, nestedShape] of Object.entries(procedureOrShape.units)) {
				writeShape({
					writer,
					procedureOrShape: nestedShape,
					path,
					middlewaresProcedureIdMap,
					config,
				})
			}
		}).write(')')
	} else {
		writeProcedure({
			writer,
			unit: procedureOrShape,
			baseProcedureId: middlewaresProcedureIdMap.get(procedureOrShape.middlewares) ?? config.baseProcedure,
		})
	}

	if (path) {
		writer.write(',')
	}

	writer.newLine()
}

export const writeNewRouter = (
	options: {
		units: Unit[]
		sourceFile: SourceFile
		topNode: Node
		config: MigrateConfig
		project: Project
	},
) => {
	const { units, sourceFile, topNode, config, project } = options

	const procedureUnits = units.filter((unit): unit is ProcedureUnit => unit.tag === 'procedure')
	const routerUnits = units.filter((unit): unit is RouterUnit => unit.tag === 'router')

	const procedureMiddlewareHashes = procedureUnits
		.map((unit) => unit.middlewares)
		.filter((unit) => unit.length > 0)
	const uniqueMiddlewareCombinations = new Set(procedureMiddlewareHashes)

	const middlewaresProcedureIdMap = new Map()
	for (const middlewares of uniqueMiddlewareCombinations.values()) {
		const middlewaresHash = middlewares.map((middleware) => middleware.hash).join('_')
		middlewaresProcedureIdMap.set(middlewares, `procedure_${middlewaresHash}`)
	}

	const routerShape: RouterShape = {
		tag: 'router',
		units: {},
		prefix: '',
	}

	for (const unit of procedureUnits) {
		const pathParts = unit.pathText.split('.')
		addProcedure(routerShape, unit, pathParts)
	}

	const childRouterUnits: RouterUnit[] = []
	const mergeRouterUnits: RouterUnit[] = []

	for (const unit of routerUnits) {
		if (unit.prefix) childRouterUnits.push(unit)
		else mergeRouterUnits.push(unit)
	}

	for (const unit of childRouterUnits) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const pathParts = unit.prefix!.split('.').filter((value) => value !== '')
		addRouter(routerShape, unit, pathParts)
	}

	const middlewareUnits = units.filter((unit): unit is MiddlewareUnit => unit.tag === 'middleware')

	const ancestors = topNode.getAncestors()
	const topLevelNode = ancestors[ancestors.length - 2]

	let insertionIndex = topLevelNode.getChildIndex()
	for (const unit of middlewareUnits) {
		sourceFile.insertVariableStatement(insertionIndex, {
			declarationKind: VariableDeclarationKind.Const,
			declarations: [{
				name: unit.id,
				initializer: `t.middleware(${unit.body})`,
			}],
		}).formatText()
		insertionIndex += 1
	}

	for (const [middlewares, procedureId] of middlewaresProcedureIdMap.entries()) {
		const middlewareUses: string[] = []
		for (const middleware of middlewares) {
			middlewareUses.push(`.use(${middleware.id})`)
		}
		sourceFile.insertVariableStatement(insertionIndex, {
			declarationKind: VariableDeclarationKind.Const,
			declarations: [{
				name: procedureId,
				initializer: `${config.baseProcedure}${middlewareUses.join('')}`,
			}],
		})
		insertionIndex += 1
	}

	sourceFile.addImportDeclarations(config.serverImports)

	if (mergeRouterUnits.length > 0) {
		const writer = project.createWriter()
		writeShape({ writer, procedureOrShape: routerShape, middlewaresProcedureIdMap, config })

		const newRouterText = writer.toString()
		const hash = getStringHash(newRouterText)
		const newRouterId = `router_${hash}`
		sourceFile.insertVariableStatement(insertionIndex, {
			declarationKind: VariableDeclarationKind.Const,
			declarations: [{
				name: newRouterId,
				initializer: newRouterText,
			}],
		})

		topNode.replaceWithText((writer) => {
			writer.write('t.mergeRouters(')
				.write(newRouterId)
				.write(',')
				.write(
					mergeRouterUnits.map((unit) => unit.identifier).join(', '),
				).write(')')
		})
	} else {
		topNode.replaceWithText((writer) => {
			writeShape({
				writer,
				procedureOrShape: routerShape,
				middlewaresProcedureIdMap,
				config,
			})
		})
	}
}
