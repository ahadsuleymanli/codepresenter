// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Register the "listTabs" command
    const listTabsCommand = vscode.commands.registerCommand('codepresenter.listTabs', () => {
        listAllTabs();
    });

    const switchToTabCommand = vscode.commands.registerCommand('codepresenter.switchToTab', async () => {
        await promptAndSwitchToTab();
    });


    // Add the commands to the extension context
    context.subscriptions.push(listTabsCommand);
    context.subscriptions.push(switchToTabCommand);
}

function listAllTabs() {
    const editors = vscode.window.visibleTextEditors;
    const tabNames = editors.map(editor => editor.document.fileName);

    if (tabNames.length === 0) {
        vscode.window.showInformationMessage('No open tabs.');
    } else {
        vscode.window.showInformationMessage('Open Tabs:\n' + tabNames.join('\n'));
    }
}

async function promptAndSwitchToTab() {
    const tabNames = getAllTabNames();
    
    if (tabNames.length === 0) {
        vscode.window.showInformationMessage('No open tabs to switch to.');
        return;
    }

    const selectedTab = await vscode.window.showQuickPick(tabNames, {
        placeHolder: 'Select a tab to switch to'
    });

    if (selectedTab) {
        switchToTab(selectedTab);
    }
}

function getAllTabNames(): string[] {
    const editors = vscode.window.visibleTextEditors;
    return editors.map(editor => editor.document.fileName);
}

function switchToTab(tabName: string) {
    const editors = vscode.window.visibleTextEditors;

    for (const editor of editors) {
        if (editor.document.fileName === tabName) {
            vscode.window.showTextDocument(editor.document);
            vscode.window.showInformationMessage(`Switched to tab: ${tabName}`);
            return;
        }
    }

    vscode.window.showWarningMessage(`Tab not found: ${tabName}`);
}



// This method is called when your extension is deactivated
export function deactivate() {}
