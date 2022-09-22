import { Node, Project } from 'ts-morph'
import { handleReactHookCall } from './react.js'
import { getRouterUnits, writeNewRouter } from './server.js'
import { MigrateConfig } from './types.js'

const resolveConfig = (config: Partial<MigrateConfig>): MigrateConfig => {
	return {
		trpcNamespace: 'trpc',
		routerFactory: 'router',
		tsconfigPath: 'tsconfig.json',
		baseProcedure: 't.procedure',
		serverImports: [],
		...config,
	}
}

export const transformv10Migration = async (config: Partial<MigrateConfig>) => {
	const resolvedConfig = resolveConfig(config)

	const project = new Project({
		tsConfigFilePath: resolvedConfig.tsconfigPath,
	})

	const sourceFiles = project.getSourceFiles()

	await Promise.all(
		sourceFiles.map(async (sourceFile) => {
			const migratedRouters: string[] = []
			sourceFile.forEachDescendant((node) => {
				if (!Node.isCallExpression(node)) return
				const firstChild = node.getFirstChild()

				if (Node.isIdentifier(firstChild) && firstChild.getText() === resolvedConfig.routerFactory) {
					const { units, topNode } = getRouterUnits({ node })

					writeNewRouter({ project, units, sourceFile, topNode, config: resolvedConfig })
					const routerNameIdentifier = topNode.getParent()?.getFirstChild()
					if (Node.isIdentifier(routerNameIdentifier)) {
						migratedRouters.push(routerNameIdentifier.getText())
					}
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

			console.log(`migrated ${sourceFile.getFilePath()}`)
			for (const router of migratedRouters) {
				console.log(`  - migrated ${router}`)
			}
			await sourceFile.save()
		}),
	)
}
