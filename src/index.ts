import { Node, Project } from 'ts-morph'
import { handleReactHookCall } from './react.js'
import { getRouterUnits, writeNewRouter } from './server.js'
import { MigrateConfig } from './types.js'

const resolveConfig = (config: Partial<MigrateConfig>): MigrateConfig => {
	return {
		trpcNamespace: 'trpc',
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
					&& callNamespaceOrCallExpression.getText() === resolvedConfig.trpcNamespace
				) {
					const procedureCallType = firstChild.getChildAtIndex(2).getText()
					const path = handleReactHookCall(procedureCallType, node)

					if (!path) return
					firstChild.replaceWithText(`${resolvedConfig.trpcNamespace}.${path}.${procedureCallType}`)
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
