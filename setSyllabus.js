/*eslint-env node, es6*/
/*eslint no-unused-vars:1*/
/*eslint no-console:0*/

var canvas = require('canvas-wrapper'),
    async = require('async');

module.exports = function (course, stepCallback) {
    course.addModuleReport('setSyllabus');

    // #1 -- get modules
    function getModules(getModulesCallback) {
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/modules`, function (err, modules) {
            if (err) {
                course.throwErr('setSyllabus', err);
                getModulesCallback(err);
                return;
            }
            course.success(
                'setSyllabus',
                `Retrieved the modules for the "${course.info.name}" course (canvasOU: ${course.info.canvasOU})`
            );
            getModulesCallback(null, modules);
        });
    }

    // 2a) get the items of one module (to be called by the next function)
    function getModuleItems(module, getModuleItemsCallback) {
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/modules/${module.id}/items`, function (err, moduleItems) {
            if (err) {
                course.throwErr('setSyllabus', err);
                getModuleItemsCallback(err);
                return;
            }
            course.success(
                'setSyllabus',
                `Retrieved the items for the ${module.name} module (id: ${module.id})`
            );
            getModuleItemsCallback(null, moduleItems);
        });
    }

    // #2 -- get all items 
    function getAllItems(modules, getItemsCallback) {
        async.map(modules, getModuleItems, function (err, allItems) {
            if (err) {
                course.throwErr('setSyllabus', err);
                getItemsCallback(err);
                return;
            }
            course.success(
                'setSyllabus',
                `Retrieved all items for all modules for the "${course.info.name}" course (canvasOU: ${course.info.canvasOU})`
            );
            getItemsCallback(null, allItems);
        });
    }

    // #3 -- either find syllabus or there is no syllabus
    function findSyllabus(allItems, findSyllabusCallback) {
        // this info will be returned to the waterfall 
        var sI = {
            courseId: '',
            moduleId: '',
            syllabusId: '',
            // for a) case
            syllabusUrl: '',
            // for b) case
            type: '',
            url: ''
        }
        allItems.forEach(function (module) {
            module.forEach(function (item) {
                var title = item.title.toLowerCase();
                if (title.includes('syllabus') &&
                    !title.includes('quiz') &&
                    !title.includes('assignment') &&
                    !title.includes('discussion') &&
                    !title.includes('activity')) {
                    sI.courseId = course.info.canvasOU;
                    sI.moduleId = item.module_id;
                    sI.syllabusId = item.id;
                    sI.syllabusUrl = item.external_url;
                    // a) external url case
                    if (item.type === 'ExternalUrl') {
                        sI.syllabusUrl = item.external_url;
                    }
                    // b) html page case
                    if (item.type === 'Page') {
                        sI.type = item.type;
                        sI.url = item.url;
                    }
                }
            });
        });
        course.success(
            'setSyllabus',
            'Syllabus has been found and the data is stored in an object'
        );
        findSyllabusCallback(null, sI);
    }

    // #4 -- process the syllabus if found or return 'syllabus not found' if not
    function putSyllabus(sI, putSyllabusCallback) {
        // DEFINE the steps of the conditional sequence
        // a) - this handels the case when the syllabus is implemented as the external url
        function a() {
            var iframe = `<iframe src="${sI.syllabusUrl}" width="100%" height="800px">Loading...</iframe>`;
            canvas.put(`/api/v1/courses/${sI.courseId}`, {
                'course[syllabus_body]': iframe
            }, function (err) {
                if (err) {
                    course.throwErr('setSyllabus', err);
                    putSyllabusCallback(err);
                    return;
                }
                course.success(
                    'setSyllabus',
                    'Successfully set the Syllabus content in the Syllabus tool'
                );
                putSyllabusCallback(null, sI);
            });
        }
        // b) - this else if will handle the case when the syllabus is implemented as the html page
        function b() {
            var object_url = sI.url;
            // to do this part use canvas.get and nest in it canvas.put 
            // for the value of the "body":"...." from the object_url
            canvas.get(object_url, function (err, array) {
                if (err) {
                    course.throwErr('setSyllabus', err);
                    putSyllabusCallback(err);
                    return;
                }
                // canvas.get passes the array here,
                // so I need to fish out the item with the title 'Syllabus'
                var html;
                array.forEach(function (item) {
                    var title = item.title.toLowerCase();
                    if (title.includes('syllabus') &&
                        !title.includes('quiz') &&
                        !title.includes('assignment') &&
                        !title.includes('discussion') &&
                        !title.includes('activity')) {
                        html = item.body;
                    }
                });
                canvas.put(`/api/v1/courses/${sI.courseId}`, {
                    'course[syllabus_body]': html
                }, function (err) {
                    if (err) {
                        course.throwErr('setSyllabus', err);
                        putSyllabusCallback(err);
                        return;
                    }
                    course.success(
                        'setSyllabus',
                        'Successfully set the Syllabus content in the Syllabus tool'
                    );
                    putSyllabusCallback(null, sI);
                });
            });
        }
        // c) - this will handle the case when there is no syllabus
        function c() {
            course.throwErr('setSyllabus', 'syllabus not found');
            putSyllabusCallback(null, 'syllabus not found');
        }

        // CALL the steps of the conditional sequence
        if ((sI.courseId !== '') && (sI.syllabusUrl !== undefined)) {
            a();
        } else if ((sI.courseId !== '') && (sI.type == 'Page')) {
            b();
        } else {
            c();
        }
    }

    // #5 -- delete the old syllabus item from modules
    function deleteSyllabusItem(sI, deleteSyllabusItemCallback) {
        if (sI === 'syllabus not found') {
            deleteSyllabusItemCallback(null, 'syllabus not found');
        } else {
            var itemToDelete = `/api/v1/courses/${sI.courseId}/modules/${sI.moduleId}/items/${sI.syllabusId}`;
            canvas.delete(itemToDelete, function (err) {
                if (err) {
                    course.throwErr('setSyllabus', err);
                    deleteSyllabusItemCallback(err);
                    return;
                }
                course.success(
                    'setSyllabus',
                    'Syllabus has been deleted from the modules'
                );
                deleteSyllabusItemCallback(null, 'done');
            });
        }
    }

    async.waterfall([
        getModules,
        getAllItems,
        findSyllabus,
        putSyllabus,
        deleteSyllabusItem
        ],
        function (err, result) {
            stepCallback(null, course);
        });
}
