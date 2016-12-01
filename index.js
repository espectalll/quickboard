/*
	QuickJiban - A simple, online, open, quick bulletin board
	Copyright (C) 2016 Francisco Gomez <espectallll@kydara.com>

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as
	published by the Free Software Foundation, either version 3 of the
	License, or (at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const app = require('express')();
const parser = require('body-parser');
const db = require('level')('./quickJiban.db', {valueEncoding: 'json'});
var lastId = 0;

app.use(parser.urlencoded({ extended: true }));
app.use(parser.json());

db.get('lastId', (err, data) => {
	if (!err && data) {
		lastId = parseInt(data);
	}
});

db.createReadStream().on('data', (data) => {
	// console.log(data.key, data.key.match(/^msg\d+$/));
	if (data.key.match(/^msg\d+$/)) {
		// TODO: set as reply if necessary
		db.put('lastId', lastId + 1, () => {
			lastId++;
		});
	};
});

app.get('/', (req, res) => {
	res.send('Heya there, Jiban here! :3');
});

app.get('/lastId', (req, res) => {
	res.send(lastId.toString());
});

app.get('/posts', (req, res) => {
	const amount = req.query['amount'];
	const fromId = req.query['fromId'];

	if (!amount || amount > 50) {
		return res.status(405).send('Invalid request, no valid amount');
	};

	if (fromId) {
		var promiseList = [];
		
		for (var i = fromId; i <= Math.min(fromId + amount, lastId); i++) {
			promiseList.push(new Promise(() => {
					db.get('msg' + i, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						};
					})
				})
			);
		};
		return Promise.all(promiseList).then((values) => {
			res.setHeader('Content-Type', 'application/json');
			res.send(values);
		}).catch((err) => {
			console.error(err);
			res.status(500).send();
		});
	} else {
		var promiseList = [];
		const startFrom = Math.max(1, lastId - amount);
		for (var i = startFrom; i <= Math.min(startFrom + amount, lastId); i++) {
			promiseList.push(new Promise((resolve, reject) => {
					db.get('msg' + i, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						};
					})
				})
			);
		};
		return Promise.all(promiseList).then((values) => {
			res.setHeader('Content-Type', 'application/json');
			res.send(values);
		}).catch((err) => {
			console.error(err);
			res.status(500).send();
		});
	};
});

app.post('/post', (req, res) => {
	var returnObj = {};
	const title = req.body['title'];
	const body = req.body['body'];
	const replyTo = req.body['replyTo'];

	returnObj['id'] = lastId + 1;
	if (title) {
		returnObj['title'] = title;
	};
	if (body) {
		returnObj['body'] = body;
	} else {
		res.setHeader('Content-Type', 'application/json');
		return res.status(405).send({'success': false});
	};
	if (replyTo && replyTo <= lastId) {
		returnObj['replyTo'] = replyTo;
	} else if (replyTo && replyTo > lastId) {
		res.setHeader('Content-Type', 'application/json');
		return res.status(405).send({'success': false});
	};

	db.put('msg' + returnObj['id'], returnObj, (err) => {
		res.setHeader('Content-Type', 'application/json');
		if (err) {
			return res.status(405).send({'success': false});
		}
		return res.send(
			{'success': true,
			 'id': returnObj['id']});
	});
});

app.listen(process.env.PORT || 8080);
