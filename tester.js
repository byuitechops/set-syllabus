/*eslint-env node, es6*/
/*eslint no-unused-vars:1*/
/*eslint no-console:0*/

// this is the url for testing
// https://byui.brightspace.com/d2l/le/content/329551/viewContent/4730294/View

var modules = require('./setSyllabus1.js');

var course = {
    info: {
        canvasOU: '375' //'874' 
    }
}

modules(course, function (err, result) {
    console.log(result);
});
