import { cp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { transformv10Migration } from '../src'
import { importsMappingToImportDeclaration } from '../src/utils.js'

it('performs correct transformations', async () => {
	const snapshotDir = path.join(__dirname, 'snapshot')
	const tempDir = path.join(__dirname, 'temp')
	await cp(snapshotDir, tempDir, { recursive: true })

	await transformv10Migration({
		tsconfigPath: path.join(tempDir, 'tsconfig.test.json'),
		serverImports: importsMappingToImportDeclaration(['t:~/server/trpc', 'adminProcedure:~/server/trpc']),
		removeServerImports: importsMappingToImportDeclaration(['router:@trpc/server']),
		routerFactory: ['createProtectedRouter', 'router'],
	})

	const [transformedServer, transformedExample, transformedClient] = await Promise.all([
		readFile(path.join(tempDir, 'server.ts'), 'utf8'),
		readFile(path.join(tempDir, 'example.ts'), 'utf8'),
		readFile(path.join(tempDir, 'client.ts'), 'utf8'),
	])

	expect(transformedServer).toMatchSnapshot()
	expect(transformedExample).toMatchSnapshot()
	expect(transformedClient).toMatchSnapshot()

	await rm(tempDir, { recursive: true })
})
