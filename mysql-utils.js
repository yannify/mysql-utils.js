var util = require('util');
var _ = require('lodash');
var moment = require('moment');

var operationsMap = {
    '=': '=',
    '!': '!=',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    '!=': '!=',
    '<>': '<>',
    'IN': 'IN',
    '!IN': 'NOT IN',
    'IS': 'IS',
    'IS NOT': 'IS NOT'
};

var Query = function (sql) {
    var self = this;
    self.sql = sql;

    self.group = function (groupBy) {
        if (_.isUndefined(groupBy)) {
            return self;
        }

        return self._append(" GROUP BY %s", groupBy);
    };

    self.order = function (where) {
        if (_.isUndefined(where)) {
            return self;
        }

        if (where.indexOf('undefined') >= 0) {
            return self;
        }

        if (_.trim(where) === '') {
            return self;
        }

        return self._append(" ORDER BY %s", where);
    };

    self.orderMulti = function (where) {
        if (_.isUndefined(where)) {
            return self;
        }

        var _order = [];
        Object.keys(where).forEach(function (col) {
            _order.push(col + ' ' + where[col]);
        });

        return self._append(" ORDER BY %s", _order.join(', '));
    };

    self.limit = function (count, offset) {
        if (_.isUndefined(count)) {
            return self;
        }

        return _.isUndefined(offset) ? self._append(" LIMIT %d", count) : self._append(" LIMIT %d OFFSET %d", count, offset);
    };

    self.where = function(queryObj, hasWhereClause) {
        if (_.isUndefined(queryObj)) { return self; }

        var _conditions = [];

        _.forEach(queryObj.criteria, function (crit) {

            var value = crit.value;
            var property = crit.field;
            var operation = operationsMap[crit.op] || '='; // Default to =
            var conjunction = crit.conjunction || 'AND';   // Default to AND
            var leftParen = crit.prependChars || '';
            var rightParen = crit.appendChars || '';

            // NOTE:
            // We used to not add the conjunction until the join after the loop, but this would mean we could not mix ANDs and ORs
            // Now we add them inline at the beginning of the string, but only if its not the first item in the array

            // NOTE:  Order is important here
            if ((operation === 'IS' || operation === 'IS NOT') && (value.indexOf('NULL') > -1)) {
                if (_conditions.length > 0) {
                    return _conditions.push(util.format('%s %s %s %s %s %s', conjunction, leftParen, property, operation, value, rightParen));
                }
                return _conditions.push(util.format('%s %s %s %s %s', leftParen, property, operation, value, rightParen));
            }

            if (operation === 'IN' || operation === '!IN') {

                if (_.isBoolean(value) || _.isNumber(value)) {
                    if (_conditions.length > 0) {
                        return _conditions.push(util.format('%s %s %s %s (%d) %s', conjunction, leftParen, property, operation, value, rightParen));
                    }
                    return _conditions.push(util.format('%s %s %s (%d) %s', leftParen, property, operation, value, rightParen));
                }


                if (_conditions.length > 0) {
                    return _conditions.push(util.format('%s %s %s %s (%s) %s', conjunction, leftParen, property, operation, value, rightParen));
                }
                return _conditions.push(util.format('%s %s %s (%s) %s', leftParen, property, operation, value, rightParen));

            }

            // Date queries - currently only works on equals
            // TODO: This needs to be made more flexible
            var isoDateRegex = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;
            if (isoDateRegex.test(value)) {

                // Convert incoming date to moment datetime in utc, then calculate a full day by adding 1 day
                var dateStart = moment.utc(value);

                // Query will check if a mysql datetime falls between a 24 hour period coverted to utc
                if (operation == '=') {
                    var dateEnd = moment.utc(value).add(1, 'day').subtract(1, 'ms');
                    var dateStr = [dateStart.format('YYYY-MM-DD h:mmA') + "'", 'AND', "'" + dateEnd.format('YYYY-MM-DD h:mmA')].join(' ');

                    if (_conditions.length > 0) {
                        return _conditions.push(util.format('%s %s %s %s %s %s', conjunction, leftParen, property, 'BETWEEN', "'" + dateStr + "'", rightParen));
                    }
                    return _conditions.push(util.format('%s %s %s %s %s', leftParen, property, 'BETWEEN', "'" + dateStr + "'", rightParen));
                } else {
                    var dateStr = dateStart.format('YYYY-MM-DD h:mmA');
                    if (_conditions.length > 0) {
                        return _conditions.push(util.format('%s %s %s %s %s %s', conjunction, leftParen, property, operation, "'" + dateStr + "'", rightParen));
                    }
                    return _conditions.push(util.format('%s %s %s %s %s', leftParen, property, operation, "'" + dateStr + "'", rightParen));
                }
            }

            if (_.isArray(value)) {
                if (_conditions.length > 0) {
                    return _conditions.push(util.format('%s %s %s %s (%s) %s', conjunction, leftParen, property, operation, value.join(', '), rightParen));
                }

                return _conditions.push(util.format('%s %s %s (%s) %s', leftParen, property, operation, value.join(', ')), rightParen);
            }

            if (_.isBoolean(value) || _.isNumber(value)) {

                if (_conditions.length > 0) {
                    return _conditions.push(util.format('%s %s %s %s %d %s', conjunction, leftParen, property, operation, value, rightParen));
                }
                return _conditions.push(util.format('%s %s %s %d %s', leftParen, property, operation, value, rightParen));

            }

            if (_.isString(value)) {

                if (_conditions.length > 0) {
                    return _conditions.push(util.format('%s %s %s %s %s %s', conjunction, leftParen, property, operation, "'" + value + "'", rightParen));
                }
                return _conditions.push(util.format('%s %s %s %s %s', leftParen, property, operation, "'" + value + "'", rightParen));
            }
        });

        if (_conditions.length > 0) {
            //return self._append(' \nWHERE ' + _conditions.join(' \n' + ' '));
            return typeof hasWhereClause != 'undefined' && hasWhereClause == true ?
                self._append(' AND ' + _conditions.join(' ')) :
                self._append(' WHERE ' + _conditions.join(' '));
        }

        return self;
    };

    self.first = function () {
        return self._append(" ORDER BY %s LIMIT 1 ", where);
    };


    self.last = function () {
        return self._append(" ORDER BY %s DESC LIMIT 1 ", where);
    };

    self._append = function (sql) {
        self.sql += arguments.length == 1 ? sql : util.format.apply(null, _.toArray(arguments));
        return self;
    };
};

if (typeof exports != 'undefined') {
    exports.Query = Query
}




