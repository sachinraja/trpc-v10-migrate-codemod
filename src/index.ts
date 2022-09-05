import { Node, Project } from 'ts-morph'
import { handleReactHookCall } from './react.js'
import { getRouterProcedures, writeNewRouter } from './server.js'
import { MigrateConfig } from './types.js'

const resolveConfig = (config: Partial<MigrateConfig>): MigrateConfig => {
	return {
		trpcNamespace: 'trpc',
		routerCreator: 'router',
		tsconfigPath: 'tsconfig.json',
		baseProcedure: 't.procedure',
		...config,
	}
}

const transformv10Migration = async (config: Partial<MigrateConfig>) => {
	const resolvedConfig = resolveConfig(config)

	const project = new Project({
		tsConfigFilePath: resolvedConfig.tsconfigPath,
	})

	const sourceFiles = project.getSourceFiles()

	await Promise.all(
		sourceFiles.map(async (sourceFile) => {
			sourceFile.forEachDescendant((node) => {
				if (!Node.isCallExpression(node)) return
				const firstChild = node.getFirstChild()

				if (Node.isIdentifier(firstChild) && firstChild.getText() === resolvedConfig.routerCreator) {
					const { units, topNode } = getRouterProcedures({ node })

					return writeNewRouter({ units, sourceFile, topNode, config: resolvedConfig })
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

			await sourceFile.save()
		}),
	)
}

transformv10Migration({
	tsconfigPath: 'test/tsconfig.test.json',
	baseProcedure: 't.procedure',
})
