#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { parseIssueUrl } from "./utils/github.js";
import { runPipeline, formatBriefAsMarkdown } from "./index.js";
import { globalSpinner } from "./utils/spinner.js";
import { runInitWizard } from "./utils/initWizard.js";
import { formatBriefAsTerminal, formatBriefAsJson, saveBriefToFile, copyToClipboard } from "./utils/formatter.js";

const program = new Command();

program
  .name("issuepilot")
  .description("Generate a starter brief for a GitHub issue for new open-source contributors")
  .version("0.1.0");

program
  .command("init")
  .description("Run the interactive setup wizard to configure GITHUB_TOKEN and AI API keys")
  .action(async () => {
    await runInitWizard();
  });

program
  .argument("[issueUrl]", "Full URL to a GitHub issue, e.g. https://github.com/owner/repo/issues/123")
  .option("--json", "Format output brief as raw JSON")
  .option("-o, --output <filePath>", "Save brief to a local markdown/json file")
  .option("-c, --copy", "Copy brief output to clipboard")
  .option("--max-turns <number>", "Maximum agent investigation turns", (val) => parseInt(val, 10))
  .option("--fallback-models <models>", "Comma-separated list of fallback model specs")
  .action(async (issueUrl: string | undefined, options: {
    json?: boolean;
    output?: string;
    copy?: boolean;
    maxTurns?: number;
    fallbackModels?: string;
  }) => {
    if (!issueUrl) {
      if (process.argv.length <= 2) {
        program.help();
        return;
      }
      console.error("❌ Error: Please provide a GitHub issue URL.");
      process.exit(1);
    }

    if (!process.env.GITHUB_TOKEN) {
      console.log("⚠️  No GITHUB_TOKEN detected in environment.");
      await runInitWizard();
      if (!process.env.GITHUB_TOKEN) {
        process.exit(1);
      }
    }

    try {
      const { owner, repo, number } = parseIssueUrl(issueUrl);
      globalSpinner.start(`Fetching issue #${number} from ${owner}/${repo}...`);
      const brief = await runPipeline(owner, repo, number, {
        maxTurns: options.maxTurns,
        fallbackModels: options.fallbackModels,
      });
      globalSpinner.stop();

      const outputText = options.json ? formatBriefAsJson(brief) : formatBriefAsTerminal(brief);
      const markdownText = formatBriefAsMarkdown(brief);

      console.log(outputText);

      if (options.output) {
        const fileContent = options.json ? formatBriefAsJson(brief) : markdownText;
        const savedPath = saveBriefToFile(fileContent, options.output);
        console.log(`\n💾 Saved brief output to: ${savedPath}`);
      }

      if (options.copy) {
        const textToCopy = options.json ? formatBriefAsJson(brief) : markdownText;
        const copied = copyToClipboard(textToCopy);
        if (copied) {
          console.log(`\n📋 Brief output copied to clipboard!`);
        } else {
          console.log(`\n⚠️  Could not access system clipboard.`);
        }
      }
    } catch (err) {
      globalSpinner.stop();
      console.error("\n❌ Error generating brief:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();
