/*eslint-env node, es6*/
/*eslint no-unused-vars:1*/
/*eslint no-console:0, semi: 2*/

/* If the courser syllabus is among modules, the step finds it 
   and rellocates it into the Syllabus folder of the course
   (it handles both, the url and the html cases for the syllabus */

/* Put dependencies here */
const canvas = require('canvas-wrapper'),
    asyncLib = require('async'),
    https = require('https');

module.exports = (course, stepCallback) => {

    // #1 -- get modules
    function getModules(getModulesCallback) {
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/modules`, function (err, modules) {
            if (err) {
                course.error(err);
                getModulesCallback(err);
                return;
            }
            // due to async nature of the programm, sometimes it may need some
            // time delay before it starts getting the modules
            // the if {...} handles that issue
            if (modules.length === 0) {
                course.warning(`Course modules have not loaded yet for the "${courseName}" course (canvasOU: ${course.info.canvasOU}). Trying again.`);
                getModules(getModulesCallback);
                return;
            }
            course.message(`Retrieved the modules for the "${courseName}" course (canvasOU: ${course.info.canvasOU})`);
            getModulesCallback(null, modules);
        });
    }

    // 2a) get the items of one module (to be called by the next function)
    function getModuleItems(module, getModuleItemsCallback) {
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/modules/${module.id}/items`, function (err, moduleItems) {
            if (err) {
                course.error(err);
                getModuleItemsCallback(err);
                return;
            }
            course.message(`Retrieved the items for the ${module.name} module (id: ${module.id})`);
            getModuleItemsCallback(null, moduleItems);
        });
    }

    // #2 -- get all items 
    function getAllItems(modules, getItemsCallback) {
        asyncLib.map(modules, getModuleItems, function (err, allItems) {
            if (err) {
                course.error(err);
                getItemsCallback(err);
                return;
            }
            course.message(`Retrieved all items for all modules for the "${courseName}" course (canvasOU: ${course.info.canvasOU})`);
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
        };
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
        course.message('Syllabus has been found and the data is stored in an object');
        findSyllabusCallback(null, sI);
    }

    // #4 -- process the syllabus if found or return 'syllabus not found' if not
    function putSyllabus(sI, putSyllabusCallback) {
        // DEFINE the steps of the conditional sequence
        // a_a) - this function will get the content that will be used in a()
        function getHTML(getHTMLcallback) {
            // this gets the html for using it in a() to put the syllabus
            https.get(`${sI.syllabusUrl}`, (res) => {
                var html = '';
                res.on('data', function (d) {
                    html += d.toString('utf8');
                });
                res.on('end', function () {
                    // before the html string is passed for the further processing
                    // I need to do three things on it
                    // #1 -- get rig of the <title> as it is displayed in the <body> somehow
                    var regex = /<title>[\s\S]*<\/title>/;
                    if (regex.test(html)) {
                        html = html.replace(regex, '');
                    }
                    // #2 -- get rid of smallbanner.jpg and largeBanner.jpg if found in the syllabus
                    regex = /<img[\s\S]*smallBanner.jpg[\s\S]*\/>/;
                    if (regex.test(html)) {
                        html = html.replace(regex, '');
                    }
                    regex = /<img[\s\S]*largeBanner.jpg[\s\S]*\/>/;
                    if (regex.test(html)) {
                        html = html.replace(regex, '');
                    }
                    // #3 -- add the syllabus template and the "Old Syllabus" red note
                    // this is just making a place for 
                    // the syllabus template
                    var index = html.search('<div id="main">');
                    var str1 = html.slice(0, index);
                    var str2 = html.slice(index, html.length);
                    html = str1 +
                        '<div id="syllabus_template"> -- THE SYLLABUS TEMPLATE WILL BE HERE -- </div>' +
                        '<h2 style="color:red;font-size: 24px;"><strong>Old Syllabus</strong></h2>' +
                        str2;
                    // now pass it for the further processing
                    getHTMLcallback(html);
                });
            }).on('error', (err) => {
                course.error(err);
                putSyllabusCallback(err);
            });
        }
        // a) - this handels the case when the syllabus is implemented as the external html page
        function a() {
            getHTML(function (html) {
                canvas.put(`/api/v1/courses/${sI.courseId}`, {
                    'course[syllabus_body]': html
                }, function (err) {
                    if (err) {
                        course.error(err);
                        putSyllabusCallback(err);
                        return;
                    }
                    course.message('Syllabus has been set in the course');
                    putSyllabusCallback(null, sI);
                });
            });
        }
        // b) - this else if will handle the case when the syllabus is implemented as the internal html page
        function b() {
            var object_url = sI.url;
            // to do this part use canvas.get and nest in it canvas.put 
            // for the value of the "body":"...." from the object_url
            canvas.get(object_url, function (err, array) {
                if (err) {
                    course.error(err);
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
                        course.error(err);
                        putSyllabusCallback(err);
                        return;
                    }
                    course.message('Syllabus has been set in the course');
                    putSyllabusCallback(null, sI);
                });
            });
        }
        // c) - this will handle the case when there is no syllabus
        function c() {
            course.warning('syllabus not found');
            putSyllabusCallback(null, 'Syllabus not found');
        }

        // CALL the steps of the conditional sequence
        if (sI.courseId !== '' && sI.syllabusUrl !== undefined) {
            a();
        } else if (sI.courseId !== '' && sI.type === 'Page') {
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
                    course.error(err);
                    deleteSyllabusItemCallback(err);
                    return;
                }
                course.message('Syllabus has been deleted from the modules');
                deleteSyllabusItemCallback(null);
            });
        }
    }


    /***************
     * START HERE
     **************/
    var validPlatforms = ['online', 'pathway'];
    if (!validPlatforms.includes(course.settings.platform)) {
        course.message('Invalid Platform. Skipping child module');
        stepCallback(null, course);
        return;
    }
    
    var courseName = course.info.fileName.split('.zip')[0];
     
    asyncLib.waterfall([
        getModules,
        getAllItems,
        findSyllabus,
        putSyllabus,
        deleteSyllabusItem
    ],
    function () {
        stepCallback(null, course);
    });
};