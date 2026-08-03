import { writeCoreState } from "./normalized-core-state-writer.js";
import { writeCommunicationState } from "./normalized-communication-state-writer.js";

export async function replaceNormalizedState(connection, data) {
  const context = await writeCoreState(connection, data);
  await writeCommunicationState(connection, data, context);
}
