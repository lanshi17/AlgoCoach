import type { CodeLanguage } from '@/types'

/**
 * Language scaffolds for the guided-learning coding stage. Problems are
 * generated dynamically, so these templates provide the common I/O shell and
 * a clear TODO without pretending to know the final function signature.
 */
export const GUIDED_CODE_TEMPLATES: Record<CodeLanguage, string> = {
  python3: `# TODO: 在这里实现解法
import sys


def solve() -> None:
    data = sys.stdin.read().split()
    # 按题目要求解析 data 并输出结果


if __name__ == "__main__":
    solve()
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: 在这里实现解法

    return 0;
}
`,
  java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        // TODO: 在这里解析输入并实现解法
    }
}
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();

    // TODO: 在这里实现解法
}
`,
  golang: `package main

import "fmt"

func main() {
    // TODO: 在这里实现解法
    fmt.Println()
}
`,
  typescript: `// TODO: 在这里实现解法
function solve(input: string): string {
  return ''
}

const input = ''
process.stdout.write(solve(input))
`,
}

export function guidedCodeTemplate(language: CodeLanguage): string {
  return GUIDED_CODE_TEMPLATES[language]
}

export function isGuidedCodeTemplate(code: string): boolean {
  const normalized = code.trim()
  return normalized.length > 0 && Object.values(GUIDED_CODE_TEMPLATES).some(template => normalized === template.trim())
}
