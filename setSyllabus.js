/*eslint-env node, es6*/
/*eslint no-unused-vars:1*/
/*eslint no-console:0*/

var canvas = require('canvas-wrapper'),
    async = require('async');

module.exports = function (course, stepCallback) {
    course.addModuleReport('setSyllabus');

    // #1 -- get modules
    function getModules(getModulesCallback) {
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/modules`, (err, modules) => {
            if (err) {
                course.throwErr('setSyllabus', err);
                getModulesCallback(err);
                return;
            }
            course.success(
                'setSyllabus',
                `Retrieved the modules for the ${course.info.canvasOU} course`
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
                `Retrieved the items for the ${module.id} module`
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
                `Retrieved the items for all modules for the ${course.info.canvasOU} course`
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
            syllabusUrl: ''
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
                }
            });
        });
        course.success(
            'setSyllabus',
            'Syllabus has been found and the data is stored in an object'
        );
        findSyllabusCallback(null, sI);
    }

    // #4 -- process the syllabus if found or just return not found
    function putSyllabus(sI, putSyllabusCallback) {
        if (sI.courseId !== '') {
            var iframe = `<iframe src="${sI.syllabusUrl}" width="100%" height="800px">Loading...</iframe>`;
            canvas.put(`/api/v1/courses/${sI.courseId}`, {
                'course[syllabus_body]': iframe,
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
        } else {
            putSyllabusCallback(null, 'syllabus not found');
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
