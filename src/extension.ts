import * as vscode from 'vscode';
import { runAfmt, defaultSpawnProcess, type OutputChannelLike } from './afmtRunner';
import { BinaryLocator, INSTALL_URL } from './binaryLocator';
import { ConfigLocator } from './configLocator';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('afmt');
  const binaryLocator = new BinaryLocator({
    configuredPath: () => vscode.workspace.getConfiguration('afmt').get<string>('path', ''),
  });
  const configLocator = new ConfigLocator(() => vscode.workspace.getConfiguration('afmt').get<string>('configFile', ''));
  const runnerOutput = output as OutputChannelLike;
  const selector: vscode.DocumentSelector = { language: 'apex', scheme: 'file' };

  const formatDocument = async (document: vscode.TextDocument): Promise<vscode.TextEdit[]> => {
    if (!vscode.workspace.getConfiguration('afmt').get<boolean>('enable', true)) {
      return [];
    }

    const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    const formatted = await runAfmt({
      text: document.getText(),
      filePath: document.uri.fsPath,
      workspaceRoot,
    }, {
      binaryLocator,
      configLocator,
      output: runnerOutput,
      spawnProcess: defaultSpawnProcess,
      showErrorMessage: (message, ...items) => vscode.window.showErrorMessage(message, ...items),
      openInstallPage: async () => {
        await vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
      },
    });

    if (formatted === null) {
      return [];
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    return [vscode.TextEdit.replace(fullRange, formatted)];
  };

  context.subscriptions.push(
    output,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('afmt.path')) {
        binaryLocator.clearCache();
      }
    }),
    vscode.languages.registerDocumentFormattingEditProvider(selector, {
      provideDocumentFormattingEdits: formatDocument,
    }),
    vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
      // afmt formats complete Apex compilation units, so a selection formats
      // the document while preserving the native Format Selection workflow.
      provideDocumentRangeFormattingEdits: formatDocument,
    }),
  );
}

export function deactivate(): void {}
