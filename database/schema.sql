CREATE DATABASE IF NOT EXISTS hash_club
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hash_club;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  auth_provider VARCHAR(30) DEFAULT 'local',
  provider_subject VARCHAR(255) DEFAULT NULL,
  university VARCHAR(150) DEFAULT '',
  major VARCHAR(150) DEFAULT '',
  bio TEXT,
  skills_json TEXT,
  social_json TEXT,
  membership_status ENUM('none', 'pending', 'accepted', 'rejected') NOT NULL DEFAULT 'none',
  membership_application_json TEXT,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NULL,
  INDEX idx_users_email (email),
  UNIQUE KEY uq_users_provider_subject (auth_provider, provider_subject),
  INDEX idx_users_membership_status (membership_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(32) PRIMARY KEY,
  author_email VARCHAR(255) NOT NULL,
  author_name VARCHAR(220) NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_posts_created_at (created_at),
  INDEX idx_posts_author_email (author_email),
  CONSTRAINT fk_posts_author_email
    FOREIGN KEY (author_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_tags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id VARCHAR(32) NOT NULL,
  tag VARCHAR(60) NOT NULL,
  INDEX idx_post_tags_post_id (post_id),
  CONSTRAINT fk_post_tags_post_id
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_likes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id VARCHAR(32) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_post_like (post_id, user_email),
  INDEX idx_post_likes_user_email (user_email),
  CONSTRAINT fk_post_likes_post_id
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_user_email
    FOREIGN KEY (user_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_comments (
  id VARCHAR(32) PRIMARY KEY,
  post_id VARCHAR(32) NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  author_name VARCHAR(220) NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_post_comments_post_id (post_id),
  INDEX idx_post_comments_created_at (created_at),
  CONSTRAINT fk_post_comments_post_id
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_author_email
    FOREIGN KEY (author_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(32) PRIMARY KEY,
  owner_email VARCHAR(255) NOT NULL,
  owner_name VARCHAR(220) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  github VARCHAR(500) DEFAULT '',
  demo VARCHAR(500) DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_projects_created_at (created_at),
  INDEX idx_projects_owner_email (owner_email),
  CONSTRAINT fk_projects_owner_email
    FOREIGN KEY (owner_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_tech (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(32) NOT NULL,
  tech VARCHAR(80) NOT NULL,
  INDEX idx_project_tech_project_id (project_id),
  CONSTRAINT fk_project_tech_project_id
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(32) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_project_vote (project_id, user_email),
  INDEX idx_project_votes_user_email (user_email),
  CONSTRAINT fk_project_votes_project_id
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_project_votes_user_email
    FOREIGN KEY (user_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR(32) PRIMARY KEY,
  author_email VARCHAR(255) NOT NULL,
  author_name VARCHAR(220) NOT NULL,
  title VARCHAR(220) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'عام',
  body LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_blog_posts_created_at (created_at),
  INDEX idx_blog_posts_author_email (author_email),
  INDEX idx_blog_posts_category (category),
  CONSTRAINT fk_blog_posts_author_email
    FOREIGN KEY (author_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(32) PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  text VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_notifications_user_email_created_at (user_email, created_at),
  CONSTRAINT fk_notifications_user_email
    FOREIGN KEY (user_email) REFERENCES users(email)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_password_reset_user (user_id),
  INDEX idx_password_reset_expiry (expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Additional interactive modules
CREATE TABLE IF NOT EXISTS event_registrations (
  id VARCHAR(32) PRIMARY KEY, event_id VARCHAR(120) NOT NULL, user_id VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_event_registration (event_id,user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS course_enrollments (
  id VARCHAR(32) PRIMARY KEY, course_id VARCHAR(120) NOT NULL, user_id VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_course_enrollment (course_id,user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(32) PRIMARY KEY, sender_id VARCHAR(32) NOT NULL, recipient_label VARCHAR(180) NOT NULL,
  body TEXT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(32) PRIMARY KEY, title VARCHAR(220) NOT NULL, assignee VARCHAR(180) NOT NULL, created_by VARCHAR(32) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS newsletter_subscribers (email VARCHAR(255) PRIMARY KEY, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS feedback (id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(32) NULL, body TEXT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mentor_bookings (id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, mentor VARCHAR(180) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_booking(user_id,mentor), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Phase 2: real resources, certificates and task workflow
CREATE TABLE IF NOT EXISTS resources (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  action_type VARCHAR(30) NOT NULL DEFAULT 'download',
  content LONGTEXT NULL,
  external_url VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS certificates (
  id VARCHAR(32) PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(240) NOT NULL,
  certificate_type VARCHAR(80) NOT NULL,
  issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  issuer_id VARCHAR(32) NULL,
  INDEX idx_cert_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_comments (
  id VARCHAR(32) PRIMARY KEY,
  task_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Phase 3: persisted settings and member interactions
CREATE TABLE IF NOT EXISTS user_preferences (
 user_id VARCHAR(32) PRIMARY KEY, privacy_profile TINYINT(1) NOT NULL DEFAULT 1, privacy_activity TINYINT(1) NOT NULL DEFAULT 1,
 notify_email TINYINT(1) NOT NULL DEFAULT 1, notify_site TINYINT(1) NOT NULL DEFAULT 1, language VARCHAR(10) NOT NULL DEFAULT 'ar', theme VARCHAR(20) NOT NULL DEFAULT 'light',
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS committee_memberships (id VARCHAR(32) PRIMARY KEY, committee_key VARCHAR(100) NOT NULL, user_id VARCHAR(32) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_committee_member (committee_key,user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS suggestion_votes (id VARCHAR(32) PRIMARY KEY, suggestion_key VARCHAR(160) NOT NULL, user_id VARCHAR(32) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_suggestion_vote (suggestion_key,user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
