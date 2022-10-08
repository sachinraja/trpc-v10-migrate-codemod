import { ImportDeclarationStructure, OptionalKind } from 'ts-morph'

export interface MigrateConfig {
	/**
	 * namespace of your tRPC React hooks
	 * @default ['trpc']
	 */
	reactNamespace: string[]
	/**
	 * namespace of your tRPC createCallers
	 * @default ['caller']
	 */
	callerNamespace: string[]
	/**
	 * namespace of your tRPC context helpers
	 * @default ['utils']
	 */
	contextNamespace: string[]

	/**
	 * the function you use to create your routers
	 * @default ['router']
	 */
	routerFactory: string[]
	/**
	 * @default 'tsconfig.json'
	 */
	tsconfigPath: string
	/**
	 * variable name of the base procedure to chain new ones from
	 * @default 't.procedure'
	 */
	baseProcedure: string
	/**
	 * imports to add to the top of every file with a transformed router
	 * @default []
	 */
	serverImports: OptionalKind<ImportDeclarationStructure>[]
	/**
	 * imports to remove from the top of every file with a transformed router
	 */
	removeServerImports: {
		moduleSpecifier: string
		namedImports: string[]
	}[]
}
