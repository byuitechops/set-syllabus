/*eslint-env node, es6*/
/*eslint no-unused-vars:1*/
/*eslint no-console:0*/

var canvas = require('canvas-wrapper');

function getPages(callBack) {
    canvas.get('/api/v1/courses/375/pages', (err, response) => {
        if (err) {
            callBack(err);
            return;
        }
        var pages = response;
        callBack(null, pages);
    });
}

function findSyllabus(callBack) {
    getPages((err, pages) => {
        if (err) {
            callBack(err);
            return;
        }
        var found = pages.find((page) => {
            return page.title.toLowerCase().includes('syllabus');
        });
        callBack(null, found);
    });
}

function getSyllabus(syllabusUrl, callback) {
    canvas.get(`/api/v1/courses/375/pages/${syllabusUrl}`, (err, response) => {
        if (err) {
            callback(err);
            return;
        }
        var syllabus = response[0].body;
        callback(null, syllabus);
    });
}

function putSyllabus(syllabusHTML, callback) {
    canvas.put('/api/v1/courses/375', {
        'course[syllabus_body]': syllabusHTML,
    }, (err1 /*, body*/ ) => {
        if (err1) {
            callback(err1);
            return;
        }
        callback(null);
    });
}


findSyllabus((error, syllabus) => {
    if (error) {
        console.error(error);
        return;
    }
    getSyllabus(syllabus.url, (getSyllabusErr, syllabusHTML) => {
        if (getSyllabusErr) {
            console.error(getSyllabusErr);
            return;
        }
        putSyllabus(syllabusHTML, (putSyllabusErr) => {
            // delete syllabus page
            if (putSyllabusErr) {
                console.log(putSyllabusErr);
                return;
            }
            canvas.delete('/api/v1/courses/375/pages/' + syllabus.url, () => {
                console.log('this url page has been deleted ' + '/api/v1/courses/375/pages/' + syllabus.url);
            });
        });
    });
});
