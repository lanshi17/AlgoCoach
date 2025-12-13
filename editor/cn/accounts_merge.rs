/*
 * @lc app=leetcode.cn id=721 lang=rust
 * @lcpr version=30304
 *
 * [721] 账户合并
 */

// @lc code=start
use std::collections::{HashMap, HashSet, VecDeque};
impl Solution {
    pub fn accounts_merge(accounts: Vec<Vec<String>>) -> Vec<Vec<String>> {
        let mut email_to_indexes: HashMap<String, Vec<usize>> = HashMap::new();
        for (index, account) in accounts.iter().enumerate() {
            for email in account.iter().skip(1) {
                email_to_indexes
                    .entry(email.clone())
                    .or_default()
                    .push(index);
            }
        }
        let mut res: Vec<Vec<String>> = Vec::new();
        let mut visited_emails: HashSet<String> = HashSet::new();
        for (email, _) in email_to_indexes.iter() {
            if visited_emails.contains(email) {
                continue;
            }
            let mut merged_emails: VecDeque<String> = VecDeque::new();
            let mut queue: VecDeque<String> = VecDeque::new();
            queue.push_back(email.clone());
            visited_emails.insert(email.clone());
            while !queue.is_empty() {
                let current_email = queue.pop_front().unwrap();
                merged_emails.push_back(current_email.clone());

                // 获取与当前邮箱关联的所有账户索引
                if let Some(indexes) = email_to_indexes.get(&current_email) {
                    for &account_index in indexes {
                        // 遍历该账户的所有邮箱
                        for other_email in accounts[account_index].iter().skip(1) {
                            if !visited_emails.contains(other_email) {
                                queue.push_back(other_email.clone());
                                visited_emails.insert(other_email.clone());
                            }
                        }
                    }
                }
            }
            // 获取用户名（使用第一个关联账户的用户名）
            let user_name = accounts[email_to_indexes.get(email).unwrap()[0]][0].clone();

            // 对收集到的邮箱进行排序
            merged_emails.make_contiguous().sort_unstable();

            // 将用户名插入到邮箱列表的开头
            merged_emails.push_front(user_name);

            // 将合并后的账户添加到结果中
            res.push(merged_emails.into_iter().collect());
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["John","johnsmith@mail.com","john_newyork@mail.com"],["John","johnsmith@mail.com","john00@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]\n
// @lcpr case=end

// @lcpr case=start
// [["Gabe","Gabe0@m.co","Gabe3@m.co","Gabe1@m.co"],["Kevin","Kevin3@m.co","Kevin5@m.co","Kevin0@m.co"],["Ethan","Ethan5@m.co","Ethan4@m.co","Ethan0@m.co"],["Hanzo","Hanzo3@m.co","Hanzo1@m.co","Hanzo0@m.co"],["Fern","Fern5@m.co","Fern1@m.co","Fern0@m.co"]]\n
// @lcpr case=end

 */
