package com.algocoach.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Map;

/**
 * Starter skeletons for judges that ship no code templates (AcWing / HDU).
 *
 * <p>Keys are the frontend's language ids ({@code rust}, {@code cpp},
 * {@code python3}, {@code typescript}, {@code golang}, {@code java}), matching
 * the editor's language selector.</p>
 */
final class CodeTemplates {

    private static final Map<String, String> TEMPLATES = Map.of(
            "cpp", """
                    #include <bits/stdc++.h>
                    using namespace std;

                    int main() {
                        ios::sync_with_stdio(false);
                        cin.tie(nullptr);
                        // TODO: read input and solve
                        return 0;
                    }
                    """,
            "python3", """
                    import sys

                    def main() -> None:
                        data = sys.stdin.read().split()
                        # TODO: read input and solve

                    if __name__ == "__main__":
                        main()
                    """,
            "rust", """
                    use std::io::{self, Read};

                    fn main() {
                        let mut input = String::new();
                        io::stdin().read_to_string(&mut input).unwrap();
                        // TODO: read input and solve
                    }
                    """,
            "golang", """
                    package main

                    import (
                    	"bufio"
                    	"fmt"
                    	"os"
                    )

                    func main() {
                    	reader := bufio.NewReader(os.Stdin)
                    	_ = reader
                    	// TODO: read input and solve
                    	fmt.Print()
                    }
                    """,
            "java", """
                    import java.io.*;
                    import java.util.*;

                    public class Main {
                        public static void main(String[] args) throws IOException {
                            // TODO: read input and solve
                        }
                    }
                    """,
            "typescript", """
                    import * as fs from "fs";

                    const input = fs.readFileSync(0, "utf8");
                    // TODO: read input and solve
                    """);

    private CodeTemplates() {
    }

    /** Build the {@code codeSnippets} array in the same shape LeetCode returns. */
    static ArrayNode snippets(ObjectMapper mapper) {
        ArrayNode snippets = mapper.createArrayNode();
        for (String lang : List.of("cpp", "python3", "rust", "golang", "java", "typescript")) {
            ObjectNode snippet = mapper.createObjectNode();
            snippet.put("lang", lang);
            snippet.put("code", TEMPLATES.get(lang));
            snippets.add(snippet);
        }
        return snippets;
    }
}
