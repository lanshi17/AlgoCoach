/*
 * @lc app=leetcode.cn id=1622 lang=rust
 * @lcpr version=30400
 *
 * [1622] 奇妙序列
 */

// @lc code=start
const MOD: i64 = 1_000_000_007;
struct Fancy {
    arr: Vec<i64>,   // 存“反变换后的 base 值”
    mul: i64,        // 全局乘法 M
    add: i64,        // 全局加法 A
    inv_mul: i64,    // M 的逆元
    inv_small: [i64; 101], // 预处理 1..=100 的逆元
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Fancy {

    fn new() -> Self {
         let mut inv_small = [0i64; 101];
        for x in 1..=100 {
            inv_small[x] = Self::mod_pow(x as i64, (MOD - 2) as i64);
        }
        Self {
            arr: Vec::new(),
            mul: 1,
            add: 0,
            inv_mul: 1,
            inv_small,
        }
    }
    
    fn append(&mut self, val: i32) {
        let v = (val as i64).rem_euclid(MOD);
        // base = (val - add) * inv_mul mod MOD
        let base = ((v - self.add).rem_euclid(MOD) * self.inv_mul).rem_euclid(MOD);
        self.arr.push(base);
    }
    
    fn add_all(&mut self, inc: i32) {
         let inc = (inc as i64).rem_euclid(MOD);
        self.add += inc;
        self.add %= MOD;
    }
    
    fn mult_all(&mut self, m: i32) {
          let m = (m as i64).rem_euclid(MOD);
        self.mul = (self.mul * m) % MOD;
        self.add = (self.add * m) % MOD;

        // inv_mul *= inv(m)
        let inv_m = self.inv_small[m as usize];
        
        self.inv_mul = (self.inv_mul * inv_m) % MOD;
    }
    
    fn get_index(&mut self, idx: i32) -> i32 {
         let i = idx as usize;
        if i >= self.arr.len() {
            return -1;
        }
        let base = self.arr[i];
        let ans = (base * self.mul + self.add) % MOD;
        ans as i32
    }
    fn mod_pow(mut a: i64, mut e: i64) -> i64 {
        a = a.rem_euclid(MOD);
        let mut r: i64 = 1;
        while e > 0 {
            if (e & 1) == 1 {
                r = (r * a) % MOD;
            }
            a = (a * a) % MOD;
            e >>= 1;
        }
        r
    }
}

/**
 * Your Fancy object will be instantiated and called as such:
 * let obj = Fancy::new();
 * obj.append(val);
 * obj.add_all(inc);
 * obj.mult_all(m);
 * let ret_4: i32 = obj.get_index(idx);
 */
// @lc code=end



/*
// @lcpr case=start
// ["Fancy","append","addAll","append","multAll","getIndex","addAll","append","multAll","getIndex","getIndex","getIndex"]\n[[],[2],[3],[7],[2],[0],[3],[10],[2],[0],[1],[2]]\n
// @lcpr case=end

 */

