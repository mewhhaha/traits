import {
  Effect,
  type Effect as AlgebraicEffect,
  type Operation,
  type TaggedOperation,
  type Uses,
} from "../../src/effects.ts";
import { type EitherValue, left, right } from "../../src/either.ts";
import { type AsTask, from_fn } from "../../src/task.ts";

export type FileSystemError =
  | readonly ["missing_file", { readonly path: string }]
  | readonly [
    "read_failed",
    { readonly path: string; readonly message: string },
  ]
  | readonly [
    "write_failed",
    { readonly path: string; readonly message: string },
  ];

export type FileSystemResult<item> = EitherValue<FileSystemError, item>;

export type ReadFile =
  & Operation<FileSystemResult<string>>
  & {
    readonly tag: "fs.read_file";
    readonly path: string;
  };

export type WriteFile =
  & Operation<FileSystemResult<void>>
  & {
    readonly tag: "fs.write_file";
    readonly path: string;
    readonly text: string;
  };

export type FileSystem = ReadFile | WriteFile;

export type FileSystemRuntime = {
  read_text(path: string): Promise<FileSystemResult<string>>;
  write_text(path: string, text: string): Promise<FileSystemResult<void>>;
};

type WithoutFileSystem<requirements> = requirements extends FileSystem ? never
  : requirements;

export function read_file(
  path: string,
): AlgebraicEffect<ReadFile, FileSystemResult<string>> {
  return Effect.send({
    tag: "fs.read_file",
    path,
  } as ReadFile);
}

export function write_file(
  path: string,
  text: string,
): AlgebraicEffect<WriteFile, FileSystemResult<void>> {
  return Effect.send({
    tag: "fs.write_file",
    path,
    text,
  } as WriteFile);
}

export function run_file_system<requirements, item>(
  effect: AlgebraicEffect<requirements, item>,
  runtime: FileSystemRuntime,
): AlgebraicEffect<WithoutFileSystem<requirements> | Uses<AsTask>, item> {
  if (effect.tag === "pure") {
    return Effect.pure(effect.value);
  }

  const operation = effect.operation as TaggedOperation;

  if (operation.tag === "fs.read_file") {
    const read = effect.operation as ReadFile;

    return Effect.bind(
      Effect.lift(from_fn(() => runtime.read_text(read.path))),
      (result) => run_file_system(effect.resume(result), runtime),
    );
  }

  if (operation.tag === "fs.write_file") {
    const write = effect.operation as WriteFile;

    return Effect.bind(
      Effect.lift(from_fn(() => runtime.write_text(write.path, write.text))),
      (result) => run_file_system(effect.resume(result), runtime),
    );
  }

  return Effect.suspend(
    effect.operation as WithoutFileSystem<requirements>,
    (value) => run_file_system(effect.resume(value), runtime),
  );
}

export function file_system_ok<item>(value: item): FileSystemResult<item> {
  return right(value) as FileSystemResult<item>;
}

export function file_system_err<item = never>(
  error: FileSystemError,
): FileSystemResult<item> {
  return left<FileSystemError, item>(error);
}

export function missing_file(path: string): FileSystemError {
  return ["missing_file", { path }];
}

export function format_file_system_error(error: FileSystemError): string {
  const [tag, payload] = error;

  switch (tag) {
    case "missing_file":
      return "missing file: " + payload.path;
    case "read_failed":
      return "could not read " + payload.path + ": " + payload.message;
    case "write_failed":
      return "could not write " + payload.path + ": " + payload.message;
  }
}
