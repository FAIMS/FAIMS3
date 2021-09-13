/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: Environment
 * Description:
 *   TODO
 */
package org.fedarch.faims3;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

/**
 * Bean for environment.properties
 * @author Rini Angreani, CSIRO
 *
 */
@Configuration
@PropertySource("classpath:../resources/environment.properties")
public class Environment {

	 @Value("${REACT_APP_DIRECTORY_HOST}")
	 private String database;

     @Bean
	 public String getDatabase() {
    	 return this.database;
	 }



}