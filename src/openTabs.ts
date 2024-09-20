import * as vscode from 'vscode';
import { TabContext, CodeSection } from './types';


export async function getOpenTabsContexts(cullFullTabContext: boolean): Promise<TabContext[]> {
    const tabContexts: TabContext[] = [];

    // Get all tabs from the current window (includes all tabs even if not active)
    const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);

    // Loop through each tab and extract its corresponding document
    for (const tab of allTabs) {
        // Skip webview tabs or tabs without a document
        if (!tab.input || !(tab.input instanceof vscode.TabInputText)) {
            continue;
        }

        const document = await vscode.workspace.openTextDocument(tab.input.uri);
        const content = document.getText();
        const codeSections = extractCodeSections(content);

        tabContexts.push({
            name: document.fileName,
            full_code: cullFullTabContext ? "" : content,
            code_sections: codeSections,
        });
    }
    // console.log(tabContexts);
    return tabContexts;
}

function extractCodeSections(content: string): CodeSection[] {
    const codeSections: CodeSection[] = [];
    const lines = content.split('\n');

    // Adjusted to match more signature types (classes, functions, etc.)
    const signatureRegex = /^(?:\s*(?:class|function|def|public|private|protected|const)\s+([a-zA-Z0-9_]+))/;

    let startLine = -1;
    let currentSignature = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(signatureRegex);

        if (match) {
            if (currentSignature && startLine !== -1) {
                codeSections.push({
                    section_signature: currentSignature,
                    span: { start: startLine, end: i - 1 },
                });
            }

            currentSignature = match[0];
            startLine = i;
        }
    }

    // Push the last code section (if any)
    if (currentSignature && startLine !== -1) {
        codeSections.push({
            section_signature: currentSignature,
            span: { start: startLine, end: lines.length - 1 },
        });
    }

    return codeSections;
}
