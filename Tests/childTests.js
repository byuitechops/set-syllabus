/* Dependencies */
const tap = require('tap');
const canvas = require('canvas-wrapper');

module.exports = (course, callback) => {
    tap.test('child-template', (test) => {

        canvas.get(`/api/v1/courses/${course.info.canvasOU}?include[]=syllabus_body`, (err, course) => {
            if (err) {
                console.error(err);
                callback(null);
                return;
            }
            test.ok(course[0].syllabus_body);
            test.end();
        });
    });

    callback(null);
};