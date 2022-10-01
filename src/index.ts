import { Node, Project } from 'ts-morph'
import { handleCallerCall } from './caller.js'
import { handleReactHookCall } from './react.js'
import { getRouterUnits, writeNewRouter } from './server.js'
import { MigrateConfig } from './types.js'

const resolveConfig = (config: Partial<MigrateConfig>): MigrateConfig => {
	return {
		reactNamespace: ['trpc'],
		callerNamespace: ['caller'],
		routerFactory: ['router'],
		tsconfigPath: 'tsconfig.json',
		baseProcedure: 't.procedure',
		serverImports: [],
		removeServerImports: [],
		...config,
	}
}

export const transformv10Migration = async (config: Partial<MigrateConfig>) => {
	const resolvedConfig = resolveConfig(config)

	const project = new Project({
		tsConfigFilePath: resolvedConfig.tsconfigPath,
	})

	const sourceFiles = project.getSourceFiles()

	const allMigratedRouters: { filePath: string; identifier: string }[] = []

	await Promise.all(
		sourceFiles.map(async (sourceFile) => {
			const sourceFileMigratedRouters: string[] = []

			const filePath = sourceFile.getFilePath()
			let serverHasChanged = false
			if (!filePath.endsWith('routers/org.ts')) {
				return
			}

			sourceFile.forEachDescendant((node) => {
				if (!Node.isCallExpression(node)) return
				const firstChild = node.getFirstChild()

				if (Node.isIdentifier(firstChild) && resolvedConfig.routerFactory.includes(firstChild.getText())) {
					const { units, topNode } = getRouterUnits({ node })

					writeNewRouter({ project, units, sourceFile, topNode, config: resolvedConfig })
					const routerNameIdentifier = topNode.getParent()?.getFirstChild()
					if (Node.isIdentifier(routerNameIdentifier)) {
						const identifier = routerNameIdentifier.getText()
						sourceFileMigratedRouters.push(identifier)
						allMigratedRouters.push({ filePath, identifier })
					}
					serverHasChanged = true
					return
				}

				if (!Node.isPropertyAccessExpression(firstChild)) return
				const callNamespaceOrCallExpression = firstChild.getFirstChild()

				if (
					Node.isIdentifier(callNamespaceOrCallExpression)
				) {
					const namespace = callNamespaceOrCallExpression.getText()
					if (resolvedConfig.reactNamespace.includes(namespace)) {
						const procedureCallType = firstChild.getChildAtIndex(2).getText()
						const path = handleReactHookCall(procedureCallType, node)

						if (!path) return
						firstChild.replaceWithText(`${resolvedConfig.reactNamespace}.${path}.${procedureCallType}`)
						return
					}

					if (resolvedConfig.callerNamespace.includes(namespace)) {
						const path = handleCallerCall(node)

						if (!path) return
						firstChild.replaceWithText(`${resolvedConfig.callerNamespace}.${path}`)
						return
					}
				}
			})

			if (serverHasChanged) {
				// add imports
				sourceFile.addImportDeclarations(resolvedConfig.serverImports)

				// remove imports
				for (const importDeclaration of sourceFile.getImportDeclarations()) {
					const removeNamedImports: string[] = []
					for (const removeImport of resolvedConfig.removeServerImports) {
						if (importDeclaration.getModuleSpecifierValue() === removeImport.moduleSpecifier) {
							removeNamedImports.push(...removeImport.namedImports)
						}
					}

					for (const namedImport of importDeclaration.getNamedImports()) {
						if (removeNamedImports.includes(namedImport.getName())) {
							namedImport.remove()
						}
					}

					if (importDeclaration.getNamedImports().length === 0) {
						importDeclaration.remove()
					}
				}
			}

			console.log(`migrated ${filePath}`)
			for (const router of sourceFileMigratedRouters) {
				console.log(`  - migrated ${router}`)
			}
			await sourceFile.save()
		}),
	)

	console.log('\nMigration Summary:')
	for (const migratedRouter of allMigratedRouters) {
		console.log(`${migratedRouter.identifier} (${migratedRouter.filePath})`)
	}
}
