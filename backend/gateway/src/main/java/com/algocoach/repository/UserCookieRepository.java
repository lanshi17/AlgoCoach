package com.algocoach.repository;

import com.algocoach.model.UserCookie;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCookieRepository extends JpaRepository<UserCookie, String> {}
