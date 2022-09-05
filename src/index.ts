import { Node, Project } from 'ts-morph'
import { handleReactHookCall } from './react.js'
import { getRouterProcedures, writeNewRouter } from './server.js'

interface MigrateOptions {
	/**
	 * @default trpc
	 */
	trpcNamespace?: string
	/**
	 * @default router
	 */
	routerCreator?: string
	/**
	 * @default tsconfig.json
	 */
	tsconfigPath?: string
}

const transformv10Migration = async (options: MigrateOptions) => {
	const {
		trpcNamespace = 'trpc',
		routerCreator = 'router',
		tsconfigPath = 'tsconfig.json',
	} = options

	const project = new Project({
		tsConfigFilePath: tsconfigPath,
	})

	const sourceFiles = project.getSourceFiles()

	await Promise.all(
		sourceFiles.map(async (sourceFile) => {
			sourceFile.forEachDescendant((node) => {
				if (!Node.isCallExpression(node)) return
				const firstChild = node.getFirstChild()

				if (Node.isIdentifier(firstChild) && firstChild.getText() === routerCreator) {
					const { units, topNode } = getRouterProcedures({ node })

					return writeNewRouter({ units, sourceFile, topNode })
				}

				if (!Node.isPropertyAccessExpression(firstChild)) return
				const callNamespaceOrCallExpression = firstChild.getFirstChild()

				if (
					Node.isIdentifier(callNamespaceOrCallExpression) && callNamespaceOrCallExpression.getText() === trpcNamespace
				) {
					const procedureCallType = firstChild.getChildAtIndex(2).getText()
					const path = handleReactHookCall(procedureCallType, node)

					if (!path) return
					firstChild.replaceWithText(`${trpcNamespace}.${path}.${procedureCallType}`)
				}
			})

			await sourceFile.save()
		}),
	)
}

transformv10Migration({
	tsconfigPath: 'test/tsconfig.test.json',
})
