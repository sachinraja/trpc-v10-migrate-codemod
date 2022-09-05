export interface MigrateConfig {
	/**
	 * @default trpc
	 */
	trpcNamespace: string
	/**
	 * @default router
	 */
	routerCreator: string
	/**
	 * @default tsconfig.json
	 */
	tsconfigPath: string
	/**
	 * Use this procedure name as the base procedure to chain new ones from.
	 * @default t.procedure
	 */
	baseProcedure: string
}
