import React from 'react'
import type { StructuredLessonContent } from '../../lib/lessonContent'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
      <div className="mt-2 text-[16px] leading-relaxed text-ink/75">
        {children}
      </div>
    </section>
  )
}

export function StructuredLesson({
  content,
}: {
  content: StructuredLessonContent
}) {
  return (
    <div className="mt-6 space-y-7">
      {content.introduction && (
        <Section title="Introduction">
          <p className="whitespace-pre-wrap">{content.introduction}</p>
        </Section>
      )}

      {content.keyConcepts.length > 0 && (
        <Section title="Concepts clés">
          <ul className="space-y-2">
            {content.keyConcepts.map((concept, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden="true" className="text-apple">
                  •
                </span>
                <span>{concept}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.explanation && (
        <Section title="Explication">
          <p className="whitespace-pre-wrap">{content.explanation}</p>
        </Section>
      )}

      {content.practicalExample && (
        <div className="rounded-card border border-apple/10 bg-oca-tint p-5">
          <Section title="Exemple pratique">
            <p className="whitespace-pre-wrap">{content.practicalExample}</p>
          </Section>
        </div>
      )}

      {content.recap && (
        <Section title="Récapitulatif">
          <p className="whitespace-pre-wrap">{content.recap}</p>
        </Section>
      )}

      {content.exercises.length > 0 && (
        <div className="rounded-card border border-hairline bg-cloud/60 p-5">
          <Section title="Exercices">
            <ol className="list-decimal space-y-2 pl-5">
              {content.exercises.map((exercise, index) => (
                <li key={index}>{exercise}</li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </div>
  )
}
