import { ImportDeclarationStructure, OptionalKind } from 'ts-morph'

export interface MigrateConfig {
	/**
	 * Namespace of the tRPC react hooks.
	 * @default trpc
	 */
	trpcNamespace: string
	/**
	 * @default router
	 */
	routerFactory: string
	/**
	 * @default tsconfig.json
	 */
	tsconfigPath: string
	/**
	 * The variable name of the base procedure to chain new ones from.
	 * @default t.procedure
	 */
	baseProcedure: string
	/**
	 * Imports to add to the top of the transformed files.
	 * @default []
	 */
	serverImports: OptionalKind<ImportDeclarationStructure>[]
}
