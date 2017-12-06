var canvas = require('canvas-wrapper');

canvas.get(`/api/v1/courses/1282/modules`, (err, modules) => {
    console.log(err);
    console.log(modules);
});
