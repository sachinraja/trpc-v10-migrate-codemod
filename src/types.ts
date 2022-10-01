import { ImportDeclarationStructure, OptionalKind } from 'ts-morph'

export interface MigrateConfig {
	/**
	 * namespace of the tRPC React hooks
	 * @default ['trpc']
	 */
	reactNamespace: string[]
	/**
	 * namespace of the tRPC callers
	 * @default ['caller']
	 */
	callerNamespace: string[]

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
	 * @default 'package.json'
	 */
	packageJSONPath: string
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
