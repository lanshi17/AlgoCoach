///question:
use std::io::{self, BufRead, BufWriter, StdinLock, StdoutLock, Write};

/// 🚀 High-Performance Scanner with utility methods
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

    /// Read next token as any type that implements FromStr
    fn next<T: std::str::FromStr>(&mut self) -> T {
        loop {
            if let Some(token) = self.buffer.pop() {
                return token.parse().ok().expect("Failed to parse token");
            }
            let mut line = String::new();
            self.reader
                .read_line(&mut line)
                .expect("Failed to read line");
            self.buffer = line.split_whitespace().rev().map(String::from).collect();
        }
    }

    /// Read an entire line as a String
    fn next_line(&mut self) -> String {
        let mut line = String::new();
        self.reader.read_line(&mut line).expect("Read error");
        line.trim().to_string()
    }

    /// Read a vector of size n: let v = scan.vec::<i32>(n);
    fn vec<T: std::str::FromStr>(&mut self, n: usize) -> Vec<T> {
        (0..n).map(|_| self.next()).collect()
    }

    /// Read a pair (e.g., coordinates): let (x, y) = scan.pair::<i32, i32>();
    fn pair<T: std::str::FromStr, U: std::str::FromStr>(&mut self) -> (T, U) {
        (self.next(), self.next())
    }
}

// --- LeetCode Style Solution Struct ---
struct Solution;

impl Solution {
    /// Entry point for logic
    pub fn solve(scan: &mut Scanner, out: &mut BufWriter<StdoutLock>) {
        // For multiple test cases, uncomment:
        // let t: usize = scan.next();
        // for _ in 0..t { Self::run(scan, out); }

        Self::run(scan, out);
    }

    fn run(scan: &mut Scanner, out: &mut BufWriter<StdoutLock>) {
        // --- YOUR CODE STARTS HERE ---
    }
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();

    // Setup fast buffered I/O according to [Rust std::io docs](https://doc.rust-lang.org)
    let mut scan = Scanner::new(stdin.lock());
    let mut out = io::BufWriter::with_capacity(128 * 1024, stdout.lock());

    Solution::solve(&mut scan, &mut out);

    // Explicit flush ensures all output is sent to CPH/Judge
    let _ = out.flush();
}

/// 🛠 Debug macro for local testing (prints to stderr)
#[macro_export]
macro_rules! dbg {
    ($($a:expr),*) => {
        #[cfg(debug_assertions)]
        eprintln!(concat!("[{:?}:{:?}] ", $(stringify!($a), " = {:?}, "),*), file!(), line!(), $($a),*);
    }
}
