/*
    This file tests the course after resetting the syllabus and
    deleting the old syllabus from the modules in main.js.
    Test 1 checks if the syllabus is at the right place.
    Test 2 checks if the syllabus is deleted from modules.
*/

/* Dependencies */
const tap = require('tap'),
    canvas = require('canvas-wrapper'),
    asyncLib = require('async');

module.exports = (course, callback) => {
    
    var courseName = course.info.fileName.split('.zip')[0];
    // TEST 1 
    function getTabs(getTabsCallback){
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/tabs`, function (err, tabs) {
            if (err) {
                course.error(err);
                getTabsCallback(err);
                return;
            }
            // due to async nature of the programm, sometimes it may need some
            // time delay before it starts getting the modules
            // the if {...} handles that issue
            if (tabs.length === 0) {
                course.warning(`Course files have not loaded yet for the "${courseName}" course (canvasOU: ${course.info.canvasOU}). Trying again.`);
                getTabs(getTabsCallback);
                return;
            }
            getTabsCallback(null, tabs);
        });
    }
    function test1(tabs, test1Callback){
        var url_to_find = `https://byui.instructure.com/courses/${course.info.canvasOU}/assignments/syllabus`;
        var url_found = '';
        tabs.forEach(function (tab) { 
            if (tab.id === 'syllabus'){
                url_found = tab.full_url;
            }
        });
        
        tap.test('set-syllabus', (test) => {
            // if syllabus is in syllabus tab
            test.equal(url_to_find, url_found);
            test.end();
            test1Callback(null);
        });
    }

    // TEST 2 
    // the module does not pass this test now because
    // there were two syllabus in the Gaunlet before the main changes it
    // the main function is made to find only 1 syllabus in modules, put it under the 
    // Syllabus tab (where it is now), 
    // and delete the old syllabus (which is also done)  
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
            getItemsCallback(null, allItems);
        });
    }
    // #3 -- find syllabus 
    function findSyllabus(allItems, findSyllabusCallback) {
        // this will be passed down the waterfall
        // to test it in the test2() 
        var search_result = [0];
        allItems.forEach(function (module) {
            module.forEach(function (item) {
                var title = item.title.toLowerCase();
                if (title.includes('syllabus') &&
                    !title.includes('quiz') &&
                    !title.includes('assignment') &&
                    !title.includes('discussion') &&
                    !title.includes('activity')) {
                    search_result[0]++;
                    search_result.push(item);
                }
            });
        });
        findSyllabusCallback(null, search_result);
    }
    // finally, test if the syllabus is no longer among modules
    function test2(search_result, test2Callback) {
        tap.test('set-syllabus', (test) => {
            // if syllabus is NOT in one of the modules
            test.equal(search_result[0], 0);
            test.end();
            test2Callback(null);
        });
    };
    
    asyncLib.waterfall([
        getTabs,
        test1,
        getModules,
        getAllItems,
        findSyllabus,
        test2
    ],
    function () {
        callback(null, course);
    });    
};
