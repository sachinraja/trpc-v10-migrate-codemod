import { Node, Project } from 'ts-morph'
import { handleCallerCall } from './caller.js'
import {
	contextHelpers,
	contextHelpersToRename,
	handleContextHelperCall,
	handleReactHookCall,
	OldContextHelper,
} from './react.js'
import { getRouterUnits, writeNewRouter } from './server.js'
import { MigrateConfig } from './types.js'

const resolveConfig = (config: Partial<MigrateConfig>): MigrateConfig => {
	return {
		reactNamespace: ['trpc'],
		callerNamespace: ['caller'],
		contextNamespace: ['utils'],
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

				if (Node.isIdentifier(firstChild)) {
					const firstChildText = firstChild.getText()
					if (resolvedConfig.reactNamespace.includes('') && ['useQuery', 'useMutation'].includes(firstChildText)) {
						const path = handleReactHookCall(firstChildText, node)
						if (!path) return

						firstChild.replaceWithText(`trpc.${path}.${firstChildText}`)
						return
					}

					if (resolvedConfig.routerFactory.includes(firstChildText)) {
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
				}

				if (!Node.isPropertyAccessExpression(firstChild)) return
				const callNamespaceOrCallExpression = firstChild.getFirstChild()

				if (Node.isIdentifier(callNamespaceOrCallExpression)) {
					const namespace = callNamespaceOrCallExpression.getText()

					const reactNamespaceMatch = resolvedConfig.reactNamespace.find((reactNamespace) =>
						reactNamespace === namespace
					)
					if (reactNamespaceMatch) {
						const procedureCallType = firstChild.getChildAtIndex(2).getText()

						const path = handleReactHookCall(procedureCallType, node)
						if (!path) return

						firstChild.replaceWithText(`${reactNamespaceMatch}.${path}.${procedureCallType}`)
						return
					}

					const callerNamespaceMatch = resolvedConfig.callerNamespace.find((callerNamespace) =>
						callerNamespace === namespace
					)
					if (callerNamespaceMatch) {
						const path = handleCallerCall(node)
						if (!path) return

						firstChild.replaceWithText(`${callerNamespaceMatch}.${path}`)
						return
					}

					if (resolvedConfig.contextNamespace.includes(namespace)) {
						const contextHelper = firstChild.getChildAtIndex(2).getText()
						if (!contextHelpers.includes(contextHelper as OldContextHelper)) return

						const renamedHelper = contextHelpersToRename[contextHelper as OldContextHelper]

						const { path, requiresUndefinedInput } = handleContextHelperCall(node)
						if (!path) return
						if (requiresUndefinedInput) {
							node.insertArgument(0, 'undefined')
						}

						firstChild.replaceWithText(`${resolvedConfig.contextNamespace}.${path}.${renamedHelper}`)
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

			// always rename @trpc/react to @trpc/react-query
			for (const importDeclaration of sourceFile.getImportDeclarations()) {
				if (importDeclaration.getModuleSpecifierValue() === '@trpc/react') {
					importDeclaration.setModuleSpecifier('@trpc/react-query')
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
