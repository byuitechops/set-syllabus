const canvas = require('canvas-wrapper');
const request = require('request');
const cheerio = require('cheerio');

var elementsToKill = [
    'main',
    'header',
    'article'
];

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
            request.get(url, (error, response, body) => {
                if (error) return reject(err);
                var syllabusTemplate = `
                    <div id="syllabus_template"> -- THE SYLLABUS TEMPLATE WILL BE HERE -- </div>
                    <h2 style="color:red;font-size: 24px;"><strong>Old Syllabus</strong></h2>
                `;
                resolve(syllabusTemplate + body);
            });
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

    /* Removes dirty HTML, adds styling classes */

    function scrubHtml(syllabusHTML) {
        var $ = cheerio.load(syllabusHTML);
        // Remove id's of main, header, article
        elementsToKill.forEach(tag => {
            if ($(`#${tag}`)) {
                $(`#${tag}`).replaceWith($(`#${tag}`).contents());
            }
        });
        // Replace i tags, b tags, with em tags, strong tags
        if ($('i')) {
            $('i').each((index, el) => {
                $(el).replaceWith(`<em>${$(el).contents()}</em>`);
            });
        }
        if ($('b')) {
            $('b').each((index, el) => {
                $(el).replaceWith(`<strong>${$(el).contents()}</strong>`);
            });
        }
        // Remove empty tags
        $(':empty').remove();

        let courseCode = course.info.courseCode.replace(/\s/g, '').split(':')[0].toLowerCase();
        return `<div class="byui ${courseCode}">${$.html()}</div>`;
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
        .then(scrubHtml)
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