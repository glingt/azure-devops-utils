#!/usr/bin/env node

import yargs from "yargs";
import * as azdev from "azure-devops-node-api";
import * as ba from "azure-devops-node-api/BuildApi";
import * as bi from "azure-devops-node-api/interfaces/BuildInterfaces";

const importCwd = require("import-cwd");

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

interface Config {
  token: string;
  project: string;
  orgUrl: string;
}

const config: Config = importCwd("./.ado-config");
// your collection url

let authHandler = azdev.getPersonalAccessTokenHandler(config.token);
let connection = new azdev.WebApi(config.orgUrl, authHandler);

yargs
  .scriptName("ado")
  .usage("Usage: $0 <command> [options]")
  .command(
    "checkout [workitem]",
    "Checkout or create a branch attached to a workitem",
    y => y.positional("workitem", { type: "string" }),
    async argv => {
      const work = await connection.getWorkApi();
      const workItemTracking = await connection.getWorkItemTrackingApi();
      const workItemTrackingProcess = await connection.getWorkItemTrackingProcessApi();
      const workitemId = parseInt(argv.workitem || "");
      const workitem = await workItemTracking.getWorkItem(workitemId, undefined, undefined, 1);

      const branches = workitem.relations || [];

      console.log(branches);

      if (branches.length === 0) {
        console.log("ADDING BRANCH");
        const git = await connection.getGitApi();
        const title = workitem.fields!["System.Title"];
        const branchName = `feature/#${argv.workitem}-${slugify(title)}`;
        console.log(branchName);

        const branchDefinition = {
          rel: "ArtifactLink",
          url:
            "vstfs:///Git/Ref/b4f10713-2687-42d5-bf0f-aa7e4b599d15%2Fa6df07d5-af82-4250-92ff-54bf189ac697%2FGBfeature%2F%23340-render-history-on-frontend",
          attributes: {
            authorizedDate: "2020-06-23T20:30:16.5Z",
            id: 2823045,
            resourceCreatedDate: "2020-06-23T20:30:16.5Z",
            resourceModifiedDate: "2020-06-23T20:30:16.5Z",
            revisedDate: "9999-01-01T00:00:00Z",
            name: "Branch",
          },
        };
        await workItemTracking.updateWorkItem(
          {},
          [{ op: "add", path: "/relations/-", value: branchDefinition }],
          workitemId,
        );
        const result = await workItemTracking.getWorkItem(workitemId, undefined, undefined, 1);
        console.log("RESULT", result.relations);
      } else {
        console.log("REMOVING BRANCH");
        await workItemTracking.updateWorkItem({}, [{ op: "remove", path: "/relations/0" }], workitemId);
        const result = await workItemTracking.getWorkItem(workitemId, undefined, undefined, 1);
        console.log("RESULT", result.relations);
      }
    },
  )
  .command("config", "Print config to the console", () => {
    console.log(config);
  })
  .command(
    "builds",
    "Outputs all build definitions",
    () => {},
    async () => {
      let build: ba.IBuildApi = await connection.getBuildApi();

      let defs: bi.DefinitionReference[] = await build.getDefinitions(config.project);

      defs.forEach((defRef: bi.DefinitionReference) => {
        console.log(`${defRef.name} (${defRef.id})`);
      });
    },
  )
  .help("h")
  .alias("h", "help").argv;
