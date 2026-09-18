import { cp, mkdir, rm, copyFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('../www/', import.meta.url);
const directories = ['css', 'data', 'fonts', 'icons', 'images', 'js'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const directory of directories) {
    await cp(new URL(`../${directory}/`, import.meta.url), new URL(`../www/${directory}/`, import.meta.url), { recursive: true });
}
for (const file of ['index.html', 'manifest.json']) {
    await copyFile(new URL(`../${file}`, import.meta.url), new URL(`../www/${file}`, import.meta.url));
}
console.log('Bundled Android interface prepared in www/.');
