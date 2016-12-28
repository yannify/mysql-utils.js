# mysql-utils.js
A small utility file for converting JavaScript Objects to SQL. Based off of code in https://github.com/robconery/massive-js

# Example:

Sample Table: Users
id | userName  | firstName | lastName | dob        |   lastLogin   |   favoriteColor
-------------------------------------------------------------------------------------
1  | f@foo.com | Fred      |  Doe    | 09/15/2000  |   11/14/2016  |    blue



var mySqlUtils = require('../lib/mysql-utils.js');

var options = {
  criteria: [
      {field: "lastLogin", op: "IS NOT", value: "NULL"},
      {field: "favoriteColor", op: "=", value: "blue"},
      // more criteria here
  ],
  sortBy: "id",
  sortDir: "DESC",
  skip: 1,
  take: 200
}

var query = new mySqlUtils.Query('SELECT * FROM Users ).where(options).order(options.sortBy + ' ' + options.sortDir).limit(options.take, options.skip).sql;

// SELECT * FROM Users WHERE lastLogin IS NOT NULL AND favoriteColor = blue;
