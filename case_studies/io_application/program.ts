import { type AsArray, from_array } from "../../src/array.ts";
import { Program, type Uses } from "../../src/effects.ts";
import { ask, type AsReader } from "../../src/reader.ts";
import { type AsWriter, tell } from "../../src/writer.ts";
import { type FileSystem, read_file, write_file } from "./filesystem.ts";
import { type CliInput, parse_command, usage } from "./types.ts";

export type StdOut = Uses<AsWriter<AsArray, string>>;

type App = FileSystem | Uses<AsReader<CliInput>> | StdOut;

const App = Program.scope<App>();

export const cli_program = App(function* () {
  const input = yield* ask<CliInput>();
  const [tag, payload] = parse_command(input.argv);

  switch (tag) {
    case "echo": {
      yield* stdout(payload.text);
      return 0;
    }

    case "cat": {
      const text = yield* read_file(payload.path);
      yield* stdout(text);
      return 0;
    }

    case "write": {
      yield* write_file(payload.path, payload.text);
      yield* stdout("wrote " + payload.path);
      return 0;
    }

    case "help": {
      yield* stdout(usage());
      return 2;
    }
  }
});

function stdout(line: string) {
  return tell(from_array([line]));
}
