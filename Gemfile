# frozen_string_literal: true
source "https://rubygems.org"
git_source(:github) {|repo_name| "https://github.com/#{repo_name}" }
gem "cocoapods"
gem "fastlane"
plugins_path = File.join(File.dirname(__FILE__), 'ios', 'App', 'fastlane', 'Pluginfile')
eval_gemfile(plugins_path) if File.exist?(plugins_path)
