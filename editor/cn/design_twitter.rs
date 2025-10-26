/*
 * @lc app=leetcode.cn id=355 lang=rust
 * @lcpr version=30300
 *
 * [355] 设计推特
 */

// @lc code=start
use std::collections::{HashMap,HashSet};
#[derive(Debug,Clone)]
struct Tweet {
    tweet_id:i32,
    user_id:i32,
    timestamp:i32,
}

struct Twitter{
    Tweets:Vec<Tweet>,
    followings:HashMap<i32,HashSet<i32>>,
    time:i32,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Twitter {

    fn new() -> Self {
        Self{
            Tweets:Vec::new(),
            followings:HashMap::new(),
            time:0,
        }
    }
    
    fn post_tweet(&mut self, user_id: i32, tweet_id: i32) {
        self.time += 1;
        let new_tweet = Tweet {
            tweet_id,
            user_id,
            timestamp: self.time,
        };
        self.Tweets.push(new_tweet);
    }
    
    fn get_news_feed(&mut self, user_id: i32) -> Vec<i32> {
        let mut followed_users=self.followings.get(&user_id).cloned().unwrap_or_default();
        let mut res:Vec<i32>=Vec::new();
        followed_users.insert(user_id);
        for tweet in self.Tweets.iter().rev() {
            if followed_users.contains(&tweet.user_id) {
                res.push(tweet.tweet_id);
            }
            if res.len() == 10 {
                break;
            }
        }
        res
    }
    
    fn follow(&mut self, follower_id: i32, followee_id: i32) {
        if follower_id == followee_id {
            return;
        }
        self.followings.entry(follower_id).or_insert_with(HashSet::new).insert(followee_id);
    }
    
    fn unfollow(&mut self, follower_id: i32, followee_id: i32) {
        if let Some(followees)=self.followings.get_mut(&follower_id){
            followees.remove(&followee_id);
        }
    }
}
/**
 * Your Twitter object will be instantiated and called as such:
 * let obj = Twitter::new();
 * obj.post_tweet(userId, tweetId);
 * let ret_2: Vec<i32> = obj.get_news_feed(userId);
 * obj.follow(followerId, followeeId);
 * obj.unfollow(followerId, followeeId);
 */
// @lc code=end



