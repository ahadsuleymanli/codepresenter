import * as vscode from 'vscode';
import { Slide, TabContext } from './types';
import { getOpenTabsContexts } from './openTabs';

export async function generateThumbnails(slides: Slide[]): Promise<{ name: string; image: string }[]> {
    // Retrieve tab contexts
    const tabContexts = await getOpenTabsContexts(false);

    // Create a map for fast access to full code
    const tabContentMap = new Map<string, string>();
    for (const tabContext of tabContexts) {
        tabContentMap.set(tabContext.name, tabContext.full_code ?? "");
    }

    const thumbnails: { name: string; image: string }[] = [];

    for (const slide of slides) {
        const tabName = slide.tab_names[0]; // Assuming only one tab for simplicity
        const fullText = tabContentMap.get(tabName);

        if (fullText) {
            const codeSnippets = await getCodeSnippets(slide, fullText);
            const thumbnailHTML = createThumbnailHTML(tabName, codeSnippets, tabContexts.find(tc => tc.name === tabName)?.full_code || "");

            thumbnails.push({ name: tabName, image: thumbnailHTML });
        }
    }

    return thumbnails;
}

async function getCodeSnippets(slide: Slide, fullText: string): Promise<string[]> {
    const snippets: string[] = [];

    for (const [startLine, endLine] of slide.tab_code_sections) {
        const code = fullText.split('\n').slice(startLine, endLine + 1).join('\n');
        snippets.push(code.trim()); // Push the trimmed code snippet
    }

    return snippets;
}

function createThumbnailHTML(fileName: string, codeSnippets: string[], fullPath: string): string {
    const codePreview = codeSnippets.map(snippet => `<pre>${escapeHtml(snippet)}</pre>`).join('<hr>');
    return `
        <div style="border: 1px solid #ccc; padding: 10px; margin: 5px; border-radius: 5px; cursor: pointer;" onclick="vscode.postMessage({ command: 'switchTab', fullPath: '${escapeHtml(fullPath)}' })">
            <strong>${escapeHtml(fileName)}</strong>
            <div>${codePreview}</div>
        </div>
    `;
}

function escapeHtml(html: string): string {
    return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
