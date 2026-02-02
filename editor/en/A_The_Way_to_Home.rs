///A frog lives on the axis Ox and needs to reach home which is in the point n. She starts from the point 1. The frog can jump to the right at a distance not more than d. So, after she jumped from the point x she can reach the point x + a, where a is an integer from 1 to d.
// For each point from 1 to n is known if there is a lily flower in it. The frog can jump only in points with a lilies. Guaranteed that there are lilies in the points 1 and n.

// Determine the minimal number of jumps that the frog needs to reach home which is in the point n from the point 1. Consider that initially the frog is in the point 1. If the frog can not reach home, print -1.

// Input
// The first line contains two integers n and d (2 ≤ n ≤ 100, 1 ≤ d ≤ n - 1) — the point, which the frog wants to reach, and the maximal length of the frog jump.

// The second line contains a string s of length n, consisting of zeros and ones. If a character of the string s equals to zero, then in the corresponding point there is no lily flower. In the other case, in the corresponding point there is a lily flower. Guaranteed that the first and the last characters of the string s equal to one.

// Output
// If the frog can not reach the home, print -1.

// In the other case, print the minimal number of jumps that the frog needs to reach the home which is in the point n from the point 1.
use std::io::{self, BufRead, BufWriter, StdinLock, StdoutLock, Write};

/// Fast I/O Scanner
struct Scanner<'a> {
    reader: StdinLock<'a>,
    buffer: Vec<String>,
}

impl<'a> Scanner<'a> {
    fn new(reader: StdinLock<'a>) -> Self {
        Self {
            reader,
            buffer: Vec::new(),
        }
    }

    fn next<T: std::str::FromStr>(&mut self) -> T {
        loop {
            if let Some(token) = self.buffer.pop() {
                return token.parse().ok().expect("Parse error");
            }
            let mut line = String::new();
            self.reader.read_line(&mut line).expect("Read error");
            self.buffer = line.split_whitespace().rev().map(String::from).collect();
        }
    }
}

// --- LeetCode Style Solution Struct ---
struct Solution;

impl Solution {
    pub fn solve(scan: &mut Scanner, out: &mut BufWriter<StdoutLock>) {
        let n: usize = scan.next();
        let d: usize = scan.next();
        let s_str: String = scan.next();
        let s = s_str.as_bytes();

        // dp[i] = min jumps to reach lily at index i
        let mut dp = vec![101i32; n];
        dp[0] = 0;

        for i in 1..n {
            if s[i] == b'1' {
                let start = if i >= d { i - d } else { 0 };
                for j in start..i {
                    if s[j] == b'1' && dp[j] != 101 {
                        dp[i] = dp[i].min(dp[j] + 1);
                    }
                }
            }
        }

        if dp[n - 1] > 100 {
            let _ = writeln!(out, "-1");
        } else {
            let _ = writeln!(out, "{}", dp[n - 1]);
        }
    }
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();

    let mut scan = Scanner::new(stdin.lock());
    let mut out = io::BufWriter::new(stdout.lock());

    Solution::solve(&mut scan, &mut out);
}
