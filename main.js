const canvas = require('canvas-wrapper');
const https = require('https');

module.exports = (course, stepCallback) => {

    function getModules() {
        return new Promise((resolve, reject) => {
            canvas.getModules(course.info.canvasOU, (err, modules) => {
                if (err) return reject(err);
                resolve(modules);
            });
        })
    }

    function getModuleItems(module) {
        return new Promise((resolve, reject) => {
            canvas.getModuleItems(course.info.canvasOU, module.id, (err, moduleItems) => {
                if (err) return reject(err);
                resolve(moduleItems);
            });
        });
    }

    /* If it was an external syllabus (i.e. equella), retrieve it */
    function getExternalSyllabus(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                var html = '';
                res.on('data', function (d) {
                    html += d.toString('utf8');
                });
                res.on('end', function () {
                    var index = html.search('<div id="main">');
                    var str1 = html.slice(0, index);
                    var str2 = html.slice(index, html.length);
                    var syllabusTemplate = `
                        <div id="syllabus_template"> -- THE SYLLABUS TEMPLATE WILL BE HERE -- </div>
                        <h2 style="color:red;font-size: 24px;"><strong>Old Syllabus</strong></h2>
                    `;
                    html = str1 + syllabusTemplate + str2;
                    resolve(html);
                });
            }).on('error', reject);
        });
    }

    /* If the syllabus was an html page, retrieve it from the course */
    function getInternalSyllabus(url) {
        return new Promise((resolve, reject) => {
            canvas.get(url, (err, page) => {
                if (err) return reject(err);
                resolve(page[0].body);
            });
        })
    }

    /* Retrieves the syllabus HTML */
    function getSyllabusTemplate(moduleItems) {
        return new Promise((resolve, reject) => {
            var syllabusModuleItem = moduleItems.find(moduleItem => /syllabus(?!\s*quiz|\s*discussion|\s*assignment|\s*activity)+/i.test(moduleItem.title));
            if (syllabusModuleItem.type === 'ExternalUrl') {
                course.message('Syllabus identified as an external syllabus (i.e. equella) - retrieving.');
                getExternalSyllabus(syllabusModuleItem.external_url)
                    .then(resolve)
                    .catch(reject);
            } else if (syllabusModuleItem.type === 'Page') {
                course.message('Syllabus identified as an internal syllabus (an html page) - retrieving.');
                getInternalSyllabus(syllabusModuleItem.url)
                    .then(resolve)
                    .catch(reject);
            } else {
                course.warning(`Syllabus module item's type was not one we account for: ${syllabusModuleItem.type}`);
            }
        });
    }

    /* Updates the syllabus in the canvas course */
    function setSyllabus(syllabusHTML) {
        return new Promise((resolve, reject) => {
            canvas.put(`/api/v1/courses/${course.info.canvasOU}`, {
                'course[syllabus_body]': syllabusHTML
            }, (err) => {
                if (err) return reject(err);
                resolve();
            })
        });
    }

    getModules()
        .then(modules => {
            var modulePromises = modules.map(module => getModuleItems(module));
            return Promise.all(modulePromises);
        })
        .then(moduleItemArr => {
            return moduleItemArr.reduce((acc, moduleItemArr) => [...acc, ...moduleItemArr]);
        })
        .then(getSyllabusTemplate)
        .then(setSyllabus)
        .then(() => {
            course.log('Syllabus', {
                'Success': 'Syllabus successfully set in the course syllabus page'
            });
            stepCallback(null, course);
        })
        .catch(err => {
            course.error(err);
            stepCallback(null, course);
        });

};