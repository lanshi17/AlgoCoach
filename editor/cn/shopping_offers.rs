/*
 * @lc app=leetcode.cn id=638 lang=rust
 * @lcpr version=30304
 *
 * [638] 大礼包
 */

// @lc code=start
impl Solution {
    pub fn shopping_offers(price: Vec<i32>, specials: Vec<Vec<i32>>, needs: Vec<i32>) -> i32 {
        let filtered_special = specials
            .into_iter()
            .filter(|special| {
                let original_cost = special
                    .iter()
                    .take(special.len() - 1)
                    .enumerate()
                    .map(|(j, &quantity)| price[j] * quantity)
                    .sum();
                let bundle_cost = *special.last().unwrap();
                bundle_cost < original_cost
            })
            .collect();
        Self::backtrack(&price, &filtered_special, &needs)
    }
    fn backtrack(price: &Vec<i32>, specials: &Vec<Vec<i32>>, needs: &Vec<i32>) -> i32 {
        let mut min_cost = Self::calculate_direct_cost(price, needs);
        for special in specials {
            let bundle_price = *special.last().unwrap();
            let mut can_use = true;
            let mut next_needs = needs.clone();
            for (i, need) in needs.iter().enumerate() {
                if *need < special[i] {
                    can_use = false;
                    break;
                }
                next_needs[i] -= special[i];
            }
            if can_use {
                let cost_with_bundle = bundle_price + Self::backtrack(price, specials, &next_needs);
                min_cost = min_cost.min(cost_with_bundle);
            }
        }
        min_cost
    }
    fn calculate_direct_cost(prices: &Vec<i32>, needs: &Vec<i32>) -> i32 {
        prices.iter().zip(needs.iter()).map(|(&p, &n)| p * n).sum()
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,5]\n[[3,0,5],[1,2,10]]\n[3,2]\n
// @lcpr case=end

// @lcpr case=start
// [2,3,4]\n[[1,1,0,4],[2,2,1,9]]\n[1,2,1]\n
// @lcpr case=end

 */
