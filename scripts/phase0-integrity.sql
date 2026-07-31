\pset tuples_only on
\pset format unaligned

WITH table_fingerprints AS (
    SELECT
        'patients' AS table_name,
        count(*)::bigint AS row_count,
        md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY t.id), '')) AS content_md5
    FROM public.patients AS t

    UNION ALL

    SELECT
        'pharmacists',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY t.id), ''))
    FROM public.pharmacists AS t

    UNION ALL

    SELECT
        'prescribers',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY t.id), ''))
    FROM public.prescribers AS t

    UNION ALL

    SELECT
        'medications',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY t.id), ''))
    FROM public.medications AS t

    UNION ALL

    SELECT
        'prep_requests',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY t.id), ''))
    FROM public.prep_requests AS t

    UNION ALL

    SELECT
        'prep_request_items',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY t.id), ''))
    FROM public.prep_request_items AS t
),
orphan_checks AS (
    SELECT
        'prep_requests.patientId' AS check_name,
        count(*)::bigint AS orphan_count
    FROM public.prep_requests AS child
    LEFT JOIN public.patients AS parent
        ON parent.id = child."patientId"
    WHERE parent.id IS NULL

    UNION ALL

    SELECT
        'prep_requests.prescriberId',
        count(*)::bigint
    FROM public.prep_requests AS child
    LEFT JOIN public.prescribers AS parent
        ON parent.id = child."prescriberId"
    WHERE child."prescriberId" IS NOT NULL
      AND parent.id IS NULL

    UNION ALL

    SELECT
        'prep_requests.pharmacistId',
        count(*)::bigint
    FROM public.prep_requests AS child
    LEFT JOIN public.pharmacists AS parent
        ON parent.id = child."pharmacistId"
    WHERE child."pharmacistId" IS NOT NULL
      AND parent.id IS NULL

    UNION ALL

    SELECT
        'prep_request_items.prepRequestId',
        count(*)::bigint
    FROM public.prep_request_items AS child
    LEFT JOIN public.prep_requests AS parent
        ON parent.id = child."prepRequestId"
    WHERE parent.id IS NULL

    UNION ALL

    SELECT
        'prep_request_items.medicationId',
        count(*)::bigint
    FROM public.prep_request_items AS child
    LEFT JOIN public.medications AS parent
        ON parent.id = child."medicationId"
    WHERE parent.id IS NULL
)
SELECT jsonb_build_object(
    'tables',
    (
        SELECT jsonb_object_agg(
            table_name,
            jsonb_build_object(
                'count',
                row_count,
                'contentMd5',
                content_md5
            )
            ORDER BY table_name
        )
        FROM table_fingerprints
    ),
    'orphans',
    (
        SELECT jsonb_object_agg(
            check_name,
            orphan_count
            ORDER BY check_name
        )
        FROM orphan_checks
    )
)::text;
