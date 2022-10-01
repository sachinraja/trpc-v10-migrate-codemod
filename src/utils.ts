import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { CodeBlockWriter, Node, ObjectLiteralElementLike, SyntaxKind } from 'ts-morph'

export const execa = promisify(exec)

export const getStringFromStringOrArrayLiteral = (node: Node) => {
	if (Node.isStringLiteral(node)) {
		return node.getLiteralValue()
	}
	if (Node.isArrayLiteralExpression(node)) {
		return node
			.getElements()[0]
			.asKindOrThrow(SyntaxKind.StringLiteral)
			.getLiteralText()
	}
}

export const writeValueFromObjectLiteralElement = (
	writer: CodeBlockWriter,
	node: ObjectLiteralElementLike,
) => {
	if (Node.isMethodDeclaration(node)) {
		if (node.isAsync()) {
			writer.write('async ')
		}
		const parameters = node
			.getParameters()
			.map((parameter) => parameter.getText())
		return writer
			.write('(')
			.write(parameters.join(', '))
			.write(') => ')
			.inlineBlock(() => {
				writer.write(node.getBodyText() ?? '')
			})
	}
	if (Node.isPropertyAssignment(node)) {
		return writer.write(node.getChildAtIndex(2).getText())
	}
	if (Node.isShorthandPropertyAssignment(node)) {
		return writer.write(node.getName())
	}
}

export const getStringLiteralOrText = (node: Node) => {
	if (Node.isStringLiteral(node)) {
		return node.getLiteralValue()
	}
	return node.getText()
}

export const getStringHash = (string_: string) => {
	let hash = 0
	for (let index = 0, length = string_.length; index < length; index++) {
		// eslint-disable-next-line unicorn/prefer-code-point
		const chr = string_.charCodeAt(index)
		hash = (hash << 5) - hash + chr
		hash = Math.trunc(hash)
	}
	return hash >>> 0
}

export const getDefinedProperties = <TObject extends Record<string, unknown>>(
	object: TObject,
): TObject =>
	Object.fromEntries(
		Object.entries(object).filter(([, v]) => v !== undefined),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	) as any

export const modifyVersions = async (packageJSON: string) => {
	const directory = process.cwd()
	if (existsSync(path.join(directory, packageJSON))) {
		const pkgs: {
			dependencies?: Record<string, string>
			devDependencies?: Record<string, string>
		} = JSON.parse(
			await fs.readFile(path.join(directory, packageJSON), 'utf8'),
		)
		let shouldPrint = false
		shouldPrint = !!(
			pkgs.dependencies
			&& (await updateOutdatedPackages(directory, pkgs.dependencies))
		)
		shouldPrint = !!(
			pkgs.devDependencies
			&& (await updateOutdatedPackages(directory, pkgs.devDependencies, true))
		)
		!shouldPrint && console.log('Packages are up to date!')
	}
}

const updateOutdatedPackages = async (
	directory: string,
	deps: Record<string, string>,
	isDevelopment?: boolean,
): Promise<boolean> => {
	const results = Object.entries(deps)
		.filter(
			([packageName, packageVersion]) =>
				(packageName.startsWith('@trpc/')
					&& !packageVersion.includes('proxy'))
				|| (packageName === 'solid-trpc' && !packageVersion.includes('beta')),
		)
		.map(([packageName]) => `${packageName}@next`)
	if (results.length > 0) {
		console.log(
			`Updating ${isDevelopment ? 'dev' : ''}Dependencies: ${
				results.join(
					', ',
				)
			}`,
		)
		await execa(
			`npm install ${results.join(' ')}${isDevelopment ? ' -D' : ''}`,
			{
				cwd: directory,
			},
		)
	}
	return results.length > 0
}
