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
    const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);

    const tabNames = allTabs
        .map(tab => (tab.input as vscode.TextDocument).uri?.fsPath)
        .filter(fileName => fileName);  // Filter out non-file tabs

    if (tabNames.length === 0) {
        vscode.window.showInformationMessage('No open tabs.');
    } else {
        vscode.window.showInformationMessage('All Open Tabs:\n' + tabNames.join('\n'));
    }
}

async function promptAndSwitchToTab() {
    // Reuse the listAllTabs logic to get all tabs
    const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
    const tabNames = allTabs
        .map(tab => (tab.input as vscode.TextDocument).uri?.fsPath)
        .filter(fileName => fileName);  // Filter out non-file tabs

    if (tabNames.length === 0) {
        vscode.window.showInformationMessage('No open tabs to switch to.');
        return;
    }

    // Show the QuickPick dialog for selecting a tab
    const selectedTab = await vscode.window.showQuickPick(tabNames, {
        placeHolder: 'Select a tab to switch to'
    });

    if (selectedTab) {
        await switchToTab(selectedTab);
    }
}

async function switchToTab(tabName: string) {
    // Use tabGroups to get all open tabs, even those not currently visible
    const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);

    for (const tab of allTabs) {
        const document = (tab.input as vscode.TextDocument).uri?.fsPath;

        // Check if the tab matches the selected tab name
        if (document === tabName) {
            // Open the document in the editor
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(document));
            vscode.window.showInformationMessage(`Switched to tab: ${tabName}`);
            return;
        }
    }

    vscode.window.showWarningMessage(`Tab not found: ${tabName}`);
}


// This method is called when your extension is deactivated
export function deactivate() {}
