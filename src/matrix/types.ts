export type MatrixDiagnosticResult =
  | {
      ok: true;
      sdkGitSha: string;
      validAlias: string;
      validAliasResult: boolean;
      invalidAlias: string;
      invalidAliasResult: boolean;
      elapsedMs: number;
    }
  | { ok: false; stage: string; message: string; details: string };
