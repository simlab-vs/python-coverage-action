// SPDX short identifier: MIT

import { defaultPorts } from "./adapters";
import { main } from "./coverage-comment";

main(defaultPorts()).catch((error) => {
  console.error(error);
  process.exit(1);
});
